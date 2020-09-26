const twoPi = Math.PI * 2;

class ToneGenerator {

	constructor(period, amplitude, harmonicStructure = [1]) {
		this.period = period;
		this.amplitude = amplitude;
		this.harmonicStructure = harmonicStructure;
		this.totalHarmonicAmplitude = harmonicStructure.reduce((a, b) => a + b, 0);
	}

	value(s) {
		let total = 0;
		for (let i = 0 ; i < this.harmonicStructure.length ; ++i)
			total += this.harmonicStructure[i] * Math.sin(s / (this.period / Math.pow(2, i)) * twoPi);
		return this.amplitude * (total / this.totalHarmonicAmplitude);
	}
}

class NoiseGenerator {

	constructor(amplitude) {
		this.amplitude = amplitude;
	}

	value (_) {
		return this.amplitude * ((2 * Math.random() - 1));
	}
}

export default class AudioGenerator{

	constructor(sampleRate, windowSize, parts) {
		this.sampleRate = sampleRate;
		this.windowSize = windowSize;
		this.s = 0;

		this.parts = [];
		let totalAmplitude = 0;
		for (const part of parts) {
			switch (part[0]) {
			case 'tone':
				totalAmplitude += part[2];
				this.parts.push(new ToneGenerator(part[1], part[2], part[3]));
				break;
			case 'noise':
				totalAmplitude += part[1];
				this.parts.push(new NoiseGenerator(part[1]));
				break;
			default:
				throw `AudioGenerator construction error: '${part[0]}' is an invalid part type. Must be 'tone' or 'noise'.`;
			}
		}

		this.totalAmplitude = totalAmplitude;
	}

	getNextWindow() {
		const window = new Array(this.windowSize);
		for (let i = 0 ; i <this.windowSize ; ++i) {
			let total = 0;
			for (const part of this.parts)
				total += part.value(this.s + i);
			window[i] = total / this.totalAmplitude;
		}
		this.s += this.windowSize;
		return window;
	}
}
