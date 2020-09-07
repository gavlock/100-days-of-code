import {Debug} from './modules/debug.mjs';
const debug = new Debug();
debug.log('starting');

import {Instrument} from './modules/instrument.mjs';

$( () => {
	debug.setLogContainer($('#log'));
	debug.log('Document ready');
	
	const AudioContext = window.AudioContext || window.webkitAudioContext;

	const instrument = new Instrument('88-key piano', 88, 49, 'A4', 440);
	debug.watch.instrument = instrument;
	
	function setupFFT(userMediaStream) {
		const audioContext = new AudioContext( {sampleRate: 48000} );
		
		const micStream = audioContext.createMediaStreamSource(userMediaStream);
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = 0.1;

		// build the graph
		micStream.connect(analyser);

		// setup the FFT data array and some other utility members
		let fft_data = new Uint8Array(analyser.frequencyBinCount);
		
		fft_data.update = () => { analyser.getByteFrequencyData(fft_data); };
		fft_data.sampleRate = audioContext.sampleRate;
		fft_data.nyquistFreq = fft_data.sampleRate / 2;
		fft_data.binBandwith = fft_data.nyquistFreq / analyser.frequencyBinCount;

		return fft_data;
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
		}

		get width() { return this.canvas.width; }
		get height() { return this.canvas.height; }

		display(fft) {
			this.context.clearRect(0, 0, this.width, this.height);

			const maxFrequency = instrument.keys.last.frequency;
			const barCount = maxFrequency / fft.binBandwith;
			const barWidth = this.width / barCount;

			const topPadding = 50;
			const bottomPadding = 50;
			const maxBarHeight = this.height - bottomPadding - topPadding;

			// draw horizontal axis ticks
			this.context.textAlign = 'center';
			const drawTick = (frequency, label) => {
				const xPos = frequency / maxFrequency * this.width;
				this.context.fillRect(xPos, this.height - bottomPadding, 1, 10);
				if (label)
					this.context.fillText(label, xPos, this.height - (bottomPadding / 2));
			};

			for (let key of instrument.keys)
				drawTick(key.frequency);
			
			for (let key of instrument.keysFromNoteName('A'))
				drawTick(key.frequency, key.note);
			
			// draw the frequency spectrum bar chart

			for (let i = 0 ; i < barCount ; ++i) {
				this.context.fillRect(i * barWidth,
				                      this.height - bottomPadding,
				                      barWidth,
				                      -(fft[i] / 256.0 * maxBarHeight));
			}

			const analysis = analyse(fft);

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
					this.context.fillRect(i * barWidth,
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
						newFundamental = i * fft.binBandwith;
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
				const fundamentalXPos = analysis.fundamental / maxFrequency * this.width;
				this.context.fillText(analysis.fundamental.toFixed(0) + ' Hz', fundamentalXPos, 20);
				const key = instrument.keyFromFrequency(analysis.fundamental);
				if (key)
					this.context.fillText(key.note, fundamentalXPos, 10);
			}

			// draw the *harmonic product* frequency spectrum bar chart

			this.context.fillStyle = this.context.strokeStyle = 'green';
			const harmonicProductRange = Math.floor((fft.nyquistFreq / instrument.keys.last.frequency) / 2);
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
				this.context.fillRect(i * barWidth,
															this.height - bottomPadding,
															barWidth,
															-(harmonicProducts[i] / maxProduct * maxBarHeight));
			}
			this.context.fillStyle = this.context.strokeStyle = 'black';

		}
	}

	function onStart(userMediaStream) {
		debug.log('Entering onStart');
		const fft = setupFFT(userMediaStream);
		const canvas = new ViewCanvas();

		debug.watch.fft = fft;
		debug.watch.canvas = canvas;

		// animation loop to update FFT data and repaint the spectrum analyzer
		const tick = () => {
			fft.update();
			canvas.display(fft);
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
				.catch(debug.error);
		}
		else
			debug.log('navigator.mediaDevices is undefined');
	});

});
