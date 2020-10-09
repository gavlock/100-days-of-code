import csv
import math
import os
import scipy.io.wavfile

isolated_notes_subpath = 'ISOL/NO'


def list_instruments(root_directory):
    files_and_dirs = ((file_or_dir, os.path.join(root_directory, file_or_dir))
                      for file_or_dir in os.listdir(root_directory))
    return ({'instrument': name, 'directory': directory}
            for name, directory in files_and_dirs if os.path.isdir(directory))


def list_samples(directory):
    for filename in os.listdir(directory):
        if filename.endswith(".wav"):
            root, _ = os.path.splitext(filename)
            txt_filename = os.path.join(directory, root+'.txt')
            if os.path.isfile(txt_filename):
                yield {'sample': root,
                       'wav_file': os.path.join(directory, root + '.wav'),
                       'txt_file': txt_filename}


def time_to_index(sample_rate, seconds, round_function=round):
    return round_function(sample_rate * seconds)


def midi_pitch_to_note_index(midi_pitch):
    # The note C0 has a MIDI pitch number of 12
    # Within my music library, C0 has a "note index" of 1
    # Both systems count in semitones,
    #   so there is a simple difference of 11 between them.
    return midi_pitch - 11


def conform_note(note, sample_rate):
    onset = time_to_index(sample_rate, float(note['OnsetTime']), math.ceil)
    offset = time_to_index(sample_rate, float(note['OffsetTime']), math.floor)
    note_index = midi_pitch_to_note_index(int(note['MidiPitch']))
    return {'onset': onset,
            'offset': offset,
            'note_index': note_index}


def read_sample_audio(wav_filename):
    return scipy.io.wavfile.read(wav_filename)


def read_sample_notes(txt_filename, sample_rate):
    with open(txt_filename) as file:
        reader = csv.DictReader(file, dialect='excel-tab')
        return [conform_note(note, sample_rate) for note in reader]


def read_sample(sample):
    sample_rate, audio = read_sample_audio(sample['wav_file'])
    notes = read_sample_notes(sample['txt_file'], sample_rate)
    return {'sample': sample['sample'],
            'sample_rate': sample_rate,
            'audio': audio.transpose() / 2**15,
            'notes': notes}


def read_samples(root_directory):
    for instrument in list_instruments(root_directory):
        for sample in list_samples(os.path.join(instrument['directory'],
                                                isolated_notes_subpath)):
            read = read_sample(sample)
            yield {'instrument': instrument['instrument'],
                   'sample': sample['sample'],
                   'sample_rate': read['sample_rate'],
                   'audio': read['audio'],
                   'notes': read['notes']}


def get_onset_clip(sample, channel, window_size):
    assert len(sample['notes']) == 1
    note = sample['notes'][0]
    onset_index = note['onset']

    window = sample['audio'][channel][onset_index:onset_index + window_size]
    return {'note': note['note_index'], 'window': window}
