import csv
import math
import os

from .. import dataset


class MAPS(dataset.DataSource):
    isolated_notes_subpath = 'ISOL/NO'
    sample_rate = 44100

    def __init__(self, root_directory):
        self.root_directory = root_directory

    def get_samples(self):
        for instrument in self.list_instruments():
            instrument_path = os.path.join(instrument['directory'],
                                           MAPS.isolated_notes_subpath)

            for sample in self.list_samples(instrument_path):
                notes = self.read_sample_notes(sample['txt_file'])

                # for now, only isolated notes are supported
                assert len(notes) == 1
                note = notes[0]

                note_index = note['index']
                note_sample = dataset.FileBasedNoteSample(sample['wav_file'],
                                                          note['onset'],
                                                          note['offset'])

                yield note_index, note_sample

    def list_instruments(self):
        files_and_dirs = ((file_or_dir,
                           os.path.join(self.root_directory, file_or_dir))
                          for file_or_dir in os.listdir(self.root_directory))

        return ({'instrument': name, 'directory': directory}
                for name, directory
                in files_and_dirs
                if os.path.isdir(directory))

    def list_samples(self, directory):
        for filename in os.listdir(directory):
            if filename.endswith(".wav"):
                root, _ = os.path.splitext(filename)
                txt_filename = os.path.join(directory, root+'.txt')
                if os.path.isfile(txt_filename):
                    yield {'sample': root,
                           'wav_file': os.path.join(directory, root + '.wav'),
                           'txt_file': txt_filename}

    def read_sample_notes(self, txt_filename):
        with open(txt_filename) as file:
            reader = csv.DictReader(file, dialect='excel-tab')
            return [self.conform_note(note) for note in reader]

    def conform_note(self, note):
        onset = self.time_to_index(float(note['OnsetTime']), math.ceil)
        offset = self.time_to_index(float(note['OffsetTime']), math.floor)
        note_index = self.midi_pitch_to_note_index(int(note['MidiPitch']))
        return {'onset': onset,
                'offset': offset,
                'index': note_index}

    def time_to_index(self, seconds, round_function=round):
        return round_function(MAPS.sample_rate * seconds)

    def midi_pitch_to_note_index(self, midi_pitch):
        # The note C0 has a MIDI pitch number of 12
        # Within my music library, C0 has a "note index" of 1
        # Both systems count in semitones,
        #   so there is a simple difference of 11 between them.
        return midi_pitch - 11
