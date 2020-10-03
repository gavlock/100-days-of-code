import csv
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


def read_sample_audio(wav_filename):
    return scipy.io.wavfile.read(wav_filename)


def read_sample_notes(txt_filename):
    with open(txt_filename) as file:
        reader = csv.DictReader(file, dialect='excel-tab')
        return [{'onset': note['OnsetTime'],
                 'offset': note['OffsetTime'],
                 'midi_pitch': note['MidiPitch']} for note in reader]


def read_sample(sample):
    sample_rate, audio = read_sample_audio(sample['wav_file'])
    notes = read_sample_notes(sample['txt_file'])
    return {'sample': sample['sample'],
            'sample_rate': sample_rate,
            'audio': audio,
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
