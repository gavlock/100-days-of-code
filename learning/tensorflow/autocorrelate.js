import Chart from './d3chart.mjs';

const dbg = window.dbg = {};

$( () => {

	const signal = new Array(2048);
	signal.fill(0);

	for (let t = 0 ; t < signal.length ; ++t)
		signal[t] += 0.5 * Math.sin(t / 60);

	for (let t = 0 ; t < signal.length ; ++t)
		signal[t] += 0.3 * Math.sin(t / 30);

	for (let t = 0 ; t < signal.length ; ++t)
		signal[t] += 0.2 * Math.sin(t / 15);

	// add noise
	const noiseScale = 0.25;
	for (let t = 0 ; t < signal.length ; ++t)
		signal[t] += noiseScale * ((2 * Math.random()) - 1);

	const signalChart = new Chart('#signal');
	dbg.signalChart = signalChart;
	const signalSeries = signalChart.plot('Noisy signal', signal, 'steelblue');

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

});
