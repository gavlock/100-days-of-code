var debugFFT;
var debugCanvas;

console.log("starting with logging");

$( () => {
	// stuff added for verbose logging to debug problems on mobile browsers
	const log = (() => {
		const logContainer = $("#log");

		return (...args) => {
			const paragraph = $("<p>");
			for (const arg of args) {
				console.log(arg);
				$("<span>").text(String(arg)).appendTo(paragraph);
			}
			paragraph.appendTo(logContainer);
			
			//console.log(message);
			//$("<p>").text(String(message)).appendTo(logContainer);
		};
	})();

	// end of verbose logging setup

	log("Document ready");
	
	const piano88 = {
		minFrequency: 27.5,
		maxFrequency: 4186.01,
		minA: 27.5,
		concertA: 440
	};
	
	function setupFFT(userMediaStream) {
		const audioContext = new AudioContext( {sampleRate: piano88.maxFrequency * 2} );
		
		// create the audio nodes
		const micStream = new MediaStreamAudioSourceNode(audioContext, {mediaStream: userMediaStream});
		const analyser = new AnalyserNode(audioContext, {fftSize: 2048, smoothingTimeConstant: 0.1});

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

	class ViewCanvas {
		constructor () {
			this.canvas = $("#view")[0];
			this.context = this.canvas.getContext('2d');

			// horizontal axis ticks will be shown at these frequencies
			this.freqTicks = [0,
												piano88.minFrequency,
												piano88.concertA,
												piano88.concertA * 2,
												piano88.concertA * 4,
												piano88.maxFrequency,
												24000
											 ];
		
		}

		get width() { return this.canvas.width; }
		get height() { return this.canvas.height; }

		display(fft) {
			this.context.clearRect(0, 0, this.width, this.height);

			const barCount = fft.length;
			const barWidth = this.width / barCount;

			const topPadding = 10;
			const bottomPadding = 50;
			const maxBarHeight = this.height - bottomPadding - topPadding;

			// draw horizontal axis ticks
			this.context.textAlign = "center";
			const drawTick = (frequency) => {
				const xPos = frequency / fft.nyquistFreq * this.width;
				this.context.fillRect(xPos, this.height - bottomPadding, 1, 10);
				this.context.fillText(frequency, xPos, this.height - (bottomPadding / 2));
			};

			for (let freq of this.freqTicks)
				drawTick(freq);

			// find frequency with highest amplitude while drawing the
			// frequency spectrum bar chart

			let maxAmplitude = 0;
			let fundamental = 0;
			for (let i = 0 ; i < barCount ; ++i) {
				const frequency = i * fft.binBandwith;
				if (fft[i] > maxAmplitude) {
					maxAmplitude = fft[i];
					fundamental = frequency;
				}
				this.context.fillRect(i * barWidth,
				                      this.height - bottomPadding,
				                      barWidth,
				                      -(fft[i] / 256.0 * maxBarHeight));
			}

			if (fundamental) {
				// display the fundamental frequency and closest note name
				// at the top of the chart
				const fundamentalXPos = fundamental / fft.nyquistFreq * this.width;
				this.context.fillText(fundamental.toFixed(0) + " Hz", fundamentalXPos, 20);
				
				const keyIndex = Math.round((12 * Math.log(fundamental / piano88.minA) / Math.log(2)));
				const keyNames = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
				this.context.fillText(keyNames[keyIndex % 12], fundamentalXPos, 10);
			}
		}
	}

	function onStart(userMediaStream) {
		log("entering onStart");
		const fft = setupFFT(userMediaStream);
		log("onStart: fft = ", fft);
		const canvas = new ViewCanvas();
		log("onStart: canvas = ", canvas);

		debugFFT = fft;
		debugCanvas = canvas;

		// animation loop to update FFT data and repaint the spectrum analyzer
		const tick = () => {
			fft.update();
			canvas.display(fft);
			window.requestAnimationFrame(tick);
		};

		window.requestAnimationFrame(tick);
	}

	function onError(error) {
		$("#errorMessage").text("Error: " + error);
		console.log(error);
	}
	
	$("#start").click( (event) => {
		if (typeof navigator.mediaDevices !== "undefined") {
			log("requesting audio");
			navigator.mediaDevices.getUserMedia( {audio: true} )
				.then( (stream) => {
					event.target.disabled = true;
					onStart(stream);
				})
				.catch(onError);
		}
		else
			log("navigator.mediaDevices is undefined");
	});

});
