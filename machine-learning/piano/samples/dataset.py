"""Dataset module for the management of note samples to be used to train the
the note detection model.
"""

import math
import random
import tensorflow as tf


class Dataset:
    """Represents a collection of note samples from a variety of data sources.

    Provides access to the samples, grouped by note.
    """

    MAX_NOTE_INDEX = 121

    def __init__(self):
        self.notes = [Silence()]
        self.notes.extend(Note(index)
                          for index
                          in range(1, Dataset.MAX_NOTE_INDEX + 1))

    def add_datasource(self, datasource):
        """Reads all samples from the given datasource into this dataset."""

        for note_index, sample in datasource.get_samples():
            self.notes[note_index].add_sample(sample)


class DataSource:
    """The base class for all data sources.

    Data sources must provide a `get_samples` method which returns a list of,
    or generator yielding, all the samples from that source.
    """

    def get_samples():
        pass


class Note:
    """A Note object represents a single note from C0 to B9."""

    def __init__(self, index):
        self.index = index
        self.samples = []

    def add_sample(self, sample):
        self.samples.append(sample)

    def has_samples(self):
        return len(self.samples) > 0

    def random_sample(self):
        return self.samples[random.randrange(0, len(self.samples))]


class Silence:
    """Silence is a note-like standin for sounds that contain
no discernable note"""

    def __init__(self):
        self.index = 0
        self.sample = SilenceSample()

    def has_samples(self):
        return True

    def random_sample(self):
        return self.sample


class NoteSample:
    """NoteSample provides access to the audio waveform of a single note."""

    def __init__(self, onset, offset):
        self.onset = onset
        self.offset = offset

    def get_onset_clip(self, window_size):
        """Returns a clip starting at the onset of the note.

        The *onset* of a note is the time at which that note's key was struck.
        The *onset clip* is a clip of the desired length starting at the onset
        of the note.
        """
        assert self.offset > self.onset + window_size
        return self.get_waveform()[self.onset:(self.onset + window_size)]

    def get_random_clip(self, window_size):
        """Returns a clip from between the onset and the offset of the note.

        The *offset* of a note is the time at which it's key was released.
        A *random clip* is clip of the desired length starting at, or after,
        the onset of the note - and ending at, or before, the note's offset.
        """

        min = self.onset
        max = self.offset - window_size
        start = random.randint(min, max)
        return self.get_waveform()[start:(start + window_size)]


class SilenceSample:
    """SilenceSample is a source of "silent" clips.

    For now, silent clips are truly silent.
    Later on, they could incorporate noise.
    """

    def __init__(self):
        self.waveform = tf.zeros([0, 1])

    def get_onset_clip(self, window_size):
        if self.waveform.shape[0] != window_size:
            self.waveform = tf.zeros([window_size, 1])
        return self.waveform

    def get_clip_at_t(self, time_after_onset, window_size):
        return self.get_onset_clip(window_size)

    def get_random_clip(self, window_size):
        return self.get_onset_clip(window_size)


class FileBasedNoteSample(NoteSample):
    """A NoteSample which lazily-loads, and caches, waveform data.

    The cached data can be cleared at any time by calling `clear`.
    """

    def __init__(self, filename, onset, offset):
        super().__init__(onset, offset)
        self.filename = filename
        self.waveform = None
        self.sample_rate = None

    def clear(self):
        """Clears the cached audio waveform data.

        Because the `sample_rate` variable is so small, `clear` removes only
        the waveform data, not the sample rate.
        """

        self.waveform = None

    def get_waveform(self):
        """Returns the waveform data for this sample. May load from disk.

        If the waveform data is not present, load from disk.
        The loaded data will be then be cached to answer future calls.
        """

        if self.waveform is None:
            file_contents = tf.io.read_file(self.filename)
            channel, sample_rate = tf.audio.decode_wav(file_contents, 1)
            self.waveform = channel
            self.sample_rate = sample_rate.numpy()

        return self.waveform

    def get_sample_rate(self):
        """Returns this samples audio sampling rate. May load from disk.

        If the waveform data is not cached, calls `get_waveform` to load it
        from disk.
        The sample rate will be then be cached to answer future calls.

        The `clear` method does not clear the sample rate.
        """

        if self.sample_rate is None:
            self.get_waveform()

        return self.sample_rate

    def get_clip_at_t(self, time_after_onset, window_size):
        """Returns a clip starting at a given time after the onset of the note.

        The *onset* of a note is the time at which that note's key was struck.
        `get_clip_at_t` returns a clip of the desired length starting at
        `time_after_onset` seconds after the onset of the note.

        Note: only works for samples that have a sample rate.
        """
        start = self.onset + math.ceil(time_after_onset * self.sample_rate)
        assert self.offset > start + window_size
        return self.get_waveform()[start:(start + window_size)]
