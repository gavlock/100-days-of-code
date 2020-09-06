function Debug() {
	this.logContainer = null;

	this.setLogContainer = (jquery) => {
		this.logContainer = jquery.length ? jquery : null;
	};

	this._logImpl = (cssClass, consoleFunction, ...args) => {
		const message = args.join(' ');

		consoleFunction(message);

		if (this.logContainer)
			$('<p>').addClass(cssClass)
			        .text(message)
							.appendTo(this.logContainer);
	};
	
	this.log = (...args) => debug._logImpl('info', console.info, ...args);

	this.error = (...args) => debug._logImpl('error', console.error, ...args);

	this.watch = {};
}

const debug = new Debug();

debug.log('starting v8');

$( () => {
	debug.setLogContainer($('#log'));
	debug.log('Document ready');
	
	const AudioContext = window.AudioContext || window.webkitAudioContext;

	class Instrument {
		// In this context, "key" has the same meaning as "key" in "an 88-key piano"
		// and _not_ as in "the key of C major"
		
		// to fit in with the music world, key numbers are 1-based (not zero-based)

		constructor(keyCount, referenceKeyNumber, referenceNote, referenceFrequency) {
			referenceNote = referenceNote.toUpperCase();
			if (referenceNote[1] == 'b')
				referenceNote[1] = '♭';
			
			this.keyCount = keyCount;
			this.referenceKeyNumber  = referenceKeyNumber;
			
			if (referenceNote[1] == '#' || referenceNote[1] == '♭') {
				this.referenceNoteName   = referenceNote.slice(0, 1);
				this.referenceNoteOctave = parseInt(referenceNote.slice(2));
			} else {
				this.referenceNoteName   = referenceNote[0];
				this.referenceNoteOctave = parseInt(referenceNote.slice(1));
			}
			
			this.referenceFrequency  = referenceFrequency;

			this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
			this.referenceNoteIndex = this.noteNames.indexOf(this.referenceNoteName);
			this.c0KeyNumber = referenceKeyNumber - this.referenceNoteIndex - (12 * this.referenceNoteOctave);

			this.keys = new Array(keyCount);
			for (let keyNumber = 1 ; keyNumber <= keyCount ; ++keyNumber)
				this.keys[keyNumber - 1] = {number: keyNumber,
				                            note:   this.keyNote(keyNumber),
				                            frequency: this.keyFrequency(keyNumber)
				                           };
		}

		keyFrequency(keyNumber) {
			return this.referenceFrequency * Math.pow(2, (keyNumber - this.referenceKeyNumber) / 12.0);
		}

		keyNote(keyNumber) {
			const noteIndex = (((keyNumber - this.referenceKeyNumber + this.referenceNoteIndex) % 12) + 12) % 12;
			const octave = Math.floor((keyNumber - this.c0KeyNumber) / 12);
			return this.noteNames[noteIndex] + octave;
		}

	}

	const piano = new Instrument(88, 49, 'A4', 440);
	debug.watch.piano = piano;
	
	const piano88 = {
		minFrequency: 27.5,
		maxFrequency: 4186.01,
		minA: 27.5,
		concertA: 440
	};
	
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

			// horizontal axis ticks will be shown at these frequencies
			this.freqTicks = [0,
												piano88.minFrequency,
												piano88.concertA,
												piano88.concertA * 2,
												piano88.concertA * 4,
												piano88.concertA * 8,
												piano88.maxFrequency,
												24000
											 ];
		
		}

		get width() { return this.canvas.width; }
		get height() { return this.canvas.height; }

		display(fft) {
			this.context.clearRect(0, 0, this.width, this.height);

			const maxFrequency = piano88.maxFrequency;
			const barCount = maxFrequency / fft.binBandwith;
			const barWidth = this.width / barCount;

			const topPadding = 50;
			const bottomPadding = 50;
			const maxBarHeight = this.height - bottomPadding - topPadding;

			// draw horizontal axis ticks
			this.context.textAlign = 'center';
			const drawTick = (frequency) => {
				const xPos = frequency / maxFrequency * this.width;
				this.context.fillRect(xPos, this.height - bottomPadding, 1, 10);
				this.context.fillText(frequency, xPos, this.height - (bottomPadding / 2));
			};

			//for (let freq of this.freqTicks)
			//	drawTick(freq);

			for (let key of piano.keys)
				drawTick(key.frequency);
			
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
				
				const keyIndex = Math.round((12 * Math.log(analysis.fundamental / piano88.minA) / Math.log(2)));
				const keyNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
				const octave = Math.floor((keyIndex + 9) / 12);
				this.context.fillText(keyNames[keyIndex % 12] + octave, fundamentalXPos, 10);
			}

			// draw the *harmonic product* frequency spectrum bar chart

			this.context.fillStyle = this.context.strokeStyle = 'green';
			const harmonicProductRange = Math.floor((fft.nyquistFreq / piano88.maxFrequency) / 2);
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
