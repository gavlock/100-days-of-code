import Chart from './d3chart.mjs';
import AudioGenerator from './audio-generator.mjs';

const dbg = window.dbg = {};

$( () => {
	const C2 = 65.4064;
	const A4 = 440;
	const C5 = 523.251;
	const C6 = 1046.50;

	const minFrequency = C2;
	const maxFrequency = C6;

	function pow2Ceil(x) {
		return Math.pow(2, Math.ceil(Math.log(x) / Math.log(2)));
	}

	const harmonicStructure = [1.0, 0.5, 0.3, 0.2];
	const audioGenerator = new AudioGenerator(48000, 512, [
		['tone', A4, 1.0, harmonicStructure],
		//['tone', C5, 1.0, harmonicStructure],
		['noise', 0.25]
	]);

	const signalChart = new Chart('#signal');
	const signalSeries = signalChart.plot('Signal', [], 'steelblue');
	const signalCorrelationSeries = signalChart.plot('Correlation', [], 'crimson');

	const correlationChart = new Chart('#correlation', audioGenerator.sampleRate);
	const correlationSeries = correlationChart.plot('Correlation', [], 'crimson');

	function frequencyToLag(frequency, sampleRate) { return sampleRate / frequency; }
	const minLag = pow2Ceil(frequencyToLag(maxFrequency, audioGenerator.sampleRate));
	const maxLag = pow2Ceil(frequencyToLag(minFrequency, audioGenerator.sampleRate));

	console.log('minLag = ' + minLag + ', maxLag = ' + maxLag);

	const signalLength = maxLag * 2;
	const signalVar = tf.variable(tf.zeros([signalLength]), false, 'signal');

	$('#step').on('click', () => {
		const newWindow = audioGenerator.getNextWindow();

		tf.tidy('autoconvolution', () => {
			let tCorrelation, tCorrelationFFT;
			const time = tf.time( () => {
				signalVar.assign(signalVar.slice(newWindow.length).concat(tf.tensor1d(newWindow)));
				const tLagged = signalVar.slice(0, signalLength - maxLag);

				const tData = signalVar.reshape([1, signalLength, 1]);
				const tKernel = tLagged.reshape([signalLength - maxLag, 1, 1]);

				const tConvolution = tData.conv1d(tKernel, 1, 'valid').squeeze();

				tCorrelation = tConvolution.div(tConvolution.abs().max());

				const tConvolutionFFT = tf.abs(tConvolution.rfft());
				//const tConvolutionFFT = tf.abs(signalVar.rfft());
				tCorrelationFFT = tConvolutionFFT.div(tConvolutionFFT.abs().max());
			});

			time.then( console.log );

			signalVar.data().then( signalSeries.update );
			tCorrelation.data().then( signalCorrelationSeries.update );
			//tCorrelationFFT.data().then( correlationSeries.update );
			tCorrelationFFT.data().then( data => correlationSeries.update(data.slice(0, 100)) );
		});
	});

});
