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
	let signal = new Array(2048);
	signal.fill(0);

	const signalChart = new Chart('#signal');
	const signalSeries = signalChart.plot('Signal', signal, 'steelblue');

	$('#step').on('click', () => {
		const newWindow = audioGenerator.getNextWindow();
		signal = signal.slice(newWindow.length).concat(newWindow);
		dbg.signal = signal;
		signalSeries.update(signal);
	});

	/*
	tf.tidy('autoconvolution', () => {
		const maxLag = Math.floor(signal.length / 2);
		const tSignal = tf.tensor1d(signal);
		const tLagged = tSignal.slice(0, signal.length - maxLag);

		const tData = tSignal.reshape([1, signal.length, 1]);
		const tKernel = tLagged.reshape([signal.length - maxLag, 1, 1]);

		const tConvolution = tData.conv1d(tKernel, 1, 'valid').squeeze();
		const tCorrelation = tConvolution.div(tConvolution.abs().max());
		tCorrelation.data().then( (data) => { signalChart.plot('Autocorrelation', data, 'crimson'); } );
	});
	*/

});
