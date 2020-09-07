export class Instrument {
	// In this context, "key" has the same meaning as "key" in "an 88-key piano"
	// and _not_ as in "the key of C major"
	
	// to fit in with the music world, key numbers are 1-based (not zero-based)

	constructor(name, keyCount, referenceKeyNumber, referenceNote, referenceFrequency) {
		this.name = name;
		
		referenceNote = referenceNote.toUpperCase();
		if (referenceNote[1] == 'b')
			referenceNote[1] = '♭';
		
		this.keyCount = keyCount;
		this.referenceKeyNumber	 = referenceKeyNumber;
		
		if (referenceNote[1] == '#' || referenceNote[1] == '♭') {
			this.referenceNoteName	 = referenceNote.slice(0, 1);
			this.referenceNoteOctave = parseInt(referenceNote.slice(2));
		} else {
			this.referenceNoteName	 = referenceNote[0];
			this.referenceNoteOctave = parseInt(referenceNote.slice(1));
		}
		
		this.referenceFrequency	 = referenceFrequency;

		this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
		this.referenceNoteIndex = this.noteNames.indexOf(this.referenceNoteName);
		this._c0KeyNumber = referenceKeyNumber - this.referenceNoteIndex - (12 * this.referenceNoteOctave);

		this.keys = new Array(keyCount);
		for (let keyNumber = 1 ; keyNumber <= keyCount ; ++keyNumber)
			this.keys[keyNumber - 1] = {number: keyNumber,
			                            note:		this._keyNote(keyNumber),
			                            frequency: this._keyFrequency(keyNumber)
			                           };

		this.keys.first = this.keys[0];
		this.keys.last = this.keys[this.keys.length - 1];
	}

	_keyFrequency(keyNumber) {
		return this.referenceFrequency * Math.pow(2, (keyNumber - this.referenceKeyNumber) / 12.0);
	}

	_keyNote(keyNumber) {
		const noteIndex = (((keyNumber - this.referenceKeyNumber + this.referenceNoteIndex) % 12) + 12) % 12;
		const octave = Math.floor((keyNumber - this._c0KeyNumber) / 12);
		return this.noteNames[noteIndex] + octave;
	}

	_keyNumberFromFrequency(frequency) {
		const relativeIndex = Math.round((12 * Math.log(frequency / this.referenceFrequency) / Math.log(2)));
		return this.referenceKeyNumber + relativeIndex;
	}

	_keyIndexFromNumber(keyNumber)	{
		return keyNumber - 1;
	}

	keyFromNumber(keyNumber) {
		if (1 <= keyNumber && keyNumber <= this.keyCount)
			return this.keys[this._keyIndexFromNumber(keyNumber)];
		else
			return undefined;
	}

	keyFromFrequency(frequency) {
		return this.keyFromNumber(this._keyNumberFromFrequency(frequency));
	}

	keysFromNoteName(noteName) {
		noteName = noteName.toUpperCase();
		if (noteName.length == 1)
			return this.keys.filter( (key) => key.note[0] == noteName
			                         && key.note[1] != '#'
			                         && key.note[1] != '♭' );
		else
			return this.keys.filter( (key) => key.note.slice(0, 2) == noteName );
	}
}
