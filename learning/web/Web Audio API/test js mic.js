import {Debug} from './modules/debug.mjs';
const debug = window.dbg = new Debug();
debug.log('starting');

import {Instrument} from './modules/instrument.mjs';

import {NoteTracker} from './modules/noteTracker.mjs';

$( () => {
	debug.setLogContainer($('#log'));
	debug.log('Document ready');
	
	const AudioContext = window.AudioContext || window.webkitAudioContext;

	const instrument = new Instrument('88-key piano', 88, 49, 'A4', 440);
	debug.watch.instrument = instrument;

	class AudioData {
		constructor(userMediaStream) {
			const audioContext = new AudioContext( {sampleRate: 48000} );
		
			const micStream = audioContext.createMediaStreamSource(userMediaStream);
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 8192;
			analyser.smoothingTimeConstant = 0.3;

			// build the graph
			micStream.connect(analyser);
			//analyser.connect(audioContext.destination);

			this.sampleRate = audioContext.sampleRate;
			this.nyquistFreq = this.sampleRate / 2;
			this.binBandwith = this.nyquistFreq / analyser.frequencyBinCount;

			this.fftData = new Uint8Array(analyser.frequencyBinCount);
			this.timeDomainData = new Uint8Array(analyser.fftSize);

			this.update = () => {
				analyser.getByteFrequencyData(this.fftData);
				analyser.getByteTimeDomainData(this.timeDomainData);
			};
		}
	}
	
	function analyse(fft) {
		let maxAmplitude = 0;
		let amplitudeAccum = 0;
		let fundamental = 0;
		
		for (let i = 0 ; i < fft.length ; ++i) {
			const frequency = i * fft.binBandwith;
			amplitudeAccum += fft[i];
			if (fft[i] > maxAmplitude) {
				maxAmplitude = fft[i];
				fundamental = frequency;
			}
		}
		
		const meanAmplitude = amplitudeAccum / fft.length;

		let varianceAccum = 0;
		for (let i = 0 ; i < fft.length ; ++i)
			varianceAccum += Math.pow(fft[i] - meanAmplitude, 2);

		const variance = varianceAccum / fft.length;
		const standardDeviation = Math.sqrt(variance);
		
		return {fundamental: fundamental,
		        meanAmplitude: meanAmplitude,
		        standardDeviation: standardDeviation
		       };
	}

	class ViewCanvas {
		constructor () {
			this.canvas = $('#view')[0];
			this.context = this.canvas.getContext('2d');
			this.noteTracker = new NoteTracker(20, 10);
			debug.watch.noteTracker = this.noteTracker;
		}

		get width() { return this.canvas.width; }
		get height() { return this.canvas.height; }

		display(audioData) {
			this.context.clearRect(0, 0, this.width, this.height);

			// scale view to include 1/2 an octave on either side of the instrument range
			const minFrequency = instrument.keys.first.frequency / 1.5;
			const maxFrequency = instrument.keys.last.frequency * 1.5;
			const frequencyRange = maxFrequency - minFrequency;
			
			const barCount = maxFrequency / audioData.binBandwith;
			const barWidth = 3; //this.width / barCount;

			const frequencyToXLinear = (frequency) => (frequency - minFrequency) / frequencyRange * this.width;
			const frequencyToXLogarithmic = (frequency) => Math.log(frequency - minFrequency) / Math.log(frequencyRange) * this.width;
			const frequencyToX = frequencyToXLogarithmic;

			const topPadding = 50;
			const bottomPadding = 50;
			const maxBarHeight = this.height - bottomPadding - topPadding;

			// draw horizontal axis ticks
			this.context.textAlign = 'center';
			const drawTick = (frequency, label) => {
				const xPos = frequencyToX(frequency);
				this.context.fillRect(xPos, this.height - bottomPadding, 1, label ? -(this.height - bottomPadding - topPadding) : 10);
				if (label) {
					this.context.fillText(label, xPos, this.height - (bottomPadding / 2));
					this.context.fillText(frequency, xPos, this.height - (bottomPadding / 4));
				}
			};

			for (let key of instrument.keys)
				drawTick(key.frequency);
			
			for (let key of instrument.keysFromNoteName('A'))
				drawTick(key.frequency, key.note);

			// Auto-correlation-based test
			const tdData = audioData.timeDomainData;

			const minLag = Math.floor(audioData.sampleRate / instrument.keys.last.frequency * 3 / 2);
			const maxLag = Math.ceil(audioData.sampleRate / (instrument.keys.first.frequency * 2 / 3));
			const windowSeconds = 0.1;

			const autocorrelate = (data, minLag, maxLag, windowSeconds) => {
				const acValues = new Array(maxLag - minLag + 1);

				const window = Math.min(windowSeconds * audioData.sampleRate, data.length);

				let maxValue = 0;
				let frequencyAtMaxValue;

				for (let lag = minLag ; lag <= maxLag ; ++lag) {
					const frequency = audioData.sampleRate / lag;
					let accum = 0;
					let count = 0;
					for (let j = 0 ; j < window - 1; ++j) {
						accum += (data[j] / 128.0 - 1) * (data[j+lag] / 128.0 - 1);
						++count;
					}
					const value = accum / count;
					acValues[lag - minLag] = [frequency, count ? value : 0];
					if (value > maxValue) {
						maxValue = value;
						frequencyAtMaxValue = frequency;
					}
				}

				acValues.fundamental = frequencyAtMaxValue;
				return acValues;
			};

			let fft = audioData.fftData;
			const analysis = analyse(fft);
			if (analysis.meanAmplitude < 0.1) {
				this.noteTracker.clear();
				return;
			}

			const acValues = autocorrelate(tdData, minLag, maxLag, windowSeconds);
			
			let min = 1;
			let max = 0;
			for (const [frequency, amplitude] of acValues) {
				min = Math.min(min, amplitude);
				max = Math.max(max, amplitude);
			}
			min = Math.max(0.95 * max, min);

			this.context.fillStyle = this.context.strokeStyle = 'blue';
			for (const [frequency, amplitude] of acValues) {
				if (amplitude > min)
					this.context.fillRect(frequencyToX(frequency),
																this.height - bottomPadding,
																barWidth,
																-((amplitude - min) / (max - min) * maxBarHeight));
			}

			if (acValues.fundamental) {
				// display the fundamental frequency and closest note name
				// at the top of the chart
				const fundamentalXPos = frequencyToX(acValues.fundamental);
				this.context.fillText(acValues.fundamental.toFixed(0) + ' Hz', fundamentalXPos, 40);
				const key = instrument.keyFromFrequency(acValues.fundamental);
				if (key)
					this.context.fillText(key.note, fundamentalXPos, 30);
				this.noteTracker.log(key && key.note);
			}
			else
				this.noteTracker.log(null);

			this.context.fillStyle = this.context.strokeStyle = 'black';
			
			// draw the frequency spectrum bar chart

			for (let i = 0 ; i < barCount ; ++i) {
				this.context.fillRect(frequencyToX(i * audioData.binBandwith),
				                      this.height - bottomPadding,
				                      barWidth,
				                      -(fft[i] / 256.0 * maxBarHeight));
			}

			const drawAmplitudeLine = (amplitude) => {
				const y = this.height - bottomPadding - amplitude / 256.0 * maxBarHeight;
				this.context.beginPath();
				this.context.moveTo(0, y);
				this.context.lineTo(this.width, y);
				this.context.stroke();
			};

			const cutoffStandardDeviations = 5;

			for (let i = 0 ; i <= cutoffStandardDeviations ; ++i)
				drawAmplitudeLine(analysis.meanAmplitude + (i * analysis.standardDeviation));

			const cutoff = Math.min(200, analysis.meanAmplitude + (cutoffStandardDeviations * analysis.standardDeviation));

			this.context.fillStyle = this.context.strokeStyle = 'red';
			drawAmplitudeLine(cutoff);

			// draw the *filtered* frequency spectrum bar chart
			
			for (let i = 0 ; i < barCount ; ++i) {
				if (fft[i] > cutoff)
					this.context.fillRect(frequencyToX(i * audioData.binBandwith),
																this.height - bottomPadding,
																barWidth,
																-(fft[i] / 256.0 * maxBarHeight));
			}
			this.context.fillStyle = this.context.strokeStyle = 'black';

			// recalculate fundamental using cutoff
			let newFundamental = 0;
			let maxAmplitude = 0;
			
			for (let i = 0 ; i < fft.length ; ++i) {
				if (fft[i] > cutoff) {
					if (fft[i] > maxAmplitude) {
						newFundamental = i * audioData.binBandwith;
						maxAmplitude = fft[i];
					}
					else
						break;
				}
			}
			analysis.fundamental = newFundamental;

			if (analysis.fundamental) {
				// display the fundamental frequency and closest note name
				// at the top of the chart
				const fundamentalXPos = frequencyToX(analysis.fundamental);
				this.context.fillText(analysis.fundamental.toFixed(0) + ' Hz', fundamentalXPos, 20);
				const key = instrument.keyFromFrequency(analysis.fundamental);
				if (key)
					this.context.fillText(key.note, fundamentalXPos, 10);
			}

			// draw the *harmonic product* frequency spectrum bar chart

			this.context.fillStyle = this.context.strokeStyle = 'green';
			const harmonicProductRange = Math.floor((audioData.nyquistFreq / instrument.keys.last.frequency) / 2);
			const harmonicProductCount = Math.floor(fft.length / harmonicProductRange);
			const harmonicProducts = new Array(harmonicProductCount);

			for (let i = 0 ; i < harmonicProductCount ; ++i) {
				let product = 1;
				for (let h = 1 ; h <= harmonicProductRange ; ++h)
					product *= (fft[h * i] / 256.0);
				harmonicProducts[i] = product;
			}

			const maxProduct = Math.max(...harmonicProducts);
			const harmonicBarCount = Math.min(barCount, harmonicProductCount);
			
			for (let i = 0 ; i < harmonicBarCount ; ++i) {
				this.context.fillRect(frequencyToX(i * audioData.binBandwith),
															this.height - bottomPadding,
															barWidth,
															-(harmonicProducts[i] / maxProduct * maxBarHeight));
			}
			this.context.fillStyle = this.context.strokeStyle = 'black';

			// display the current identified note
			if (this.noteTracker.current) {
				this.context.fillStyle = this.context.strokeStyle = 'purple';
				const previousFont = this.context.font;
				this.context.font = '60px sans-serif';
				this.context.fillText(this.noteTracker.current, 60, 60);
				this.context.font = previousFont;
				this.context.fillStyle = this.context.strokeStyle = 'black';
			}

		}
	}

	function onStart(userMediaStream) {
		debug.log('Entering onStart');
		const audioData = new AudioData(userMediaStream);
		const canvas = new ViewCanvas();

		debug.watch.audioData = audioData;
		debug.watch.canvas = canvas;

		// animation loop to update audio data and repaint the spectrum analyzer
		const tick = () => {
			audioData.update();
			canvas.display(audioData);
			window.requestAnimationFrame(tick);
		};

		window.requestAnimationFrame(tick);
	}

	$('#start').click( (event) => {
		if (typeof navigator.mediaDevices !== 'undefined') {
			debug.log('Requesting audio');
			navigator.mediaDevices.getUserMedia( {audio: true} )
				.then( (stream) => {
					event.target.disabled = true;
					onStart(stream);
				})
				.catch((error) => debug.error);
		}
		else
			debug.log('navigator.mediaDevices is undefined');
	});

});
