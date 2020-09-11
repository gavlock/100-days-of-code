export class NoteTracker {

	constructor(ringLength, threshold) {
		this._ringLength = ringLength;
		this._threshold = threshold;
		this.clear();
	}

	clear() {
		this.current = null;
		this._ringBuffer = new Array(this.ringLength);
		this._ringIndex = 0;

		this._noteCount = new Map();
	}

	log(note) {
		this._increment(note);
		this._decrement(this._ringBuffer[this._ringIndex]);
		this._ringBuffer[this._ringIndex] = note;
		this._ringIndex = (this._ringIndex + 1) % this._ringLength;

		let maxCount = 0;
		let noteWithMaxCount;
		for (let [note, count] of this._noteCount) {
			if (count > maxCount) {
				maxCount = count;
				noteWithMaxCount = note;
			}
		}

		if (maxCount >= this._threshold)
			this.current = noteWithMaxCount;
		else
			this.current = null;
	}

	_increment(note) {
		if (note) {
			const oldValue = this._noteCount.get(note) || 0;
			this._noteCount.set(note, oldValue + 1);
		}
	}

	_decrement(note) {
		if (note) {
			const oldValue = this._noteCount.get(note);
			if (oldValue && oldValue > 1)
				this._noteCount.set(note, oldValue - 1);
			else
				this._noteCount.delete(note);
		}
	}

}
