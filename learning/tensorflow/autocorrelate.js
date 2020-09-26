import Chart from './d3chart.mjs';
import AudioGenerator from './audio-generator.mjs';

const dbg = window.dbg = {};

$( () => {
	const A4 = 440;
	const C5 = 523.251;
	const harmonicStructure = [1.0, 0.5, 0.3, 0.2];
	const audioGenerator = new AudioGenerator(48000, 512,
																						[['tone', A4, 1.0, harmonicStructure],
																						 //['tone', C5, 1.0, harmonicStructure],
																						 ['noise', 0.25]]);

	dbg.audioGenerator = audioGenerator;

	const signalChart = new Chart('#signal');
	const signalSeries = signalChart.plot('Signal', [], 'steelblue');
	const correlationSeries = signalChart.plot('Correlation', [], 'crimson');

	function frequencyToLag(frequency, sampleRate) { return sampleRate / frequency; }
	const minFrequency = 65.4064; // C2
	const maxFrequency = 1046.50; // C6

	function pow2Ceil(x) {
		return Math.pow(2, Math.ceil(Math.log(x) / Math.log(2)));
	}
	const minLag = pow2Ceil(frequencyToLag(maxFrequency, audioGenerator.sampleRate));
	const maxLag = pow2Ceil(frequencyToLag(minFrequency, audioGenerator.sampleRate));

	console.log('minLag = ' + minLag + ', maxLag = ' + maxLag);

	const signalLength = maxLag * 2;
	const signalVar = tf.variable(tf.zeros([signalLength]), false, 'signal');

	$('#step').on('click', () => {
		const newWindow = audioGenerator.getNextWindow();

		tf.tidy('autoconvolution', () => {
			signalVar.assign(signalVar.slice(newWindow.length).concat(tf.tensor1d(newWindow)));
			const tLagged = signalVar.slice(0, signalLength - maxLag);

			const tData = signalVar.reshape([1, signalLength, 1]);
			const tKernel = tLagged.reshape([signalLength - maxLag, 1, 1]);

			const tConvolution = tData.conv1d(tKernel, 1, 'valid').squeeze();
			const tCorrelation = tConvolution.div(tConvolution.abs().max());

			tCorrelation.data().then( correlationSeries.update );
			signalVar.data().then( signalSeries.update );
		});
	});

});
