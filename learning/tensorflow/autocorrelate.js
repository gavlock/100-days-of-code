const dbg = window.dbg = {};

class Chart {

	constructor(selector) {
		this._svg = $(selector)[0];
		this._d3 = d3.select(this._svg);

		const width = this._svg.clientWidth;
		const height = this._svg.clientHeight;

		this._d3.attr('viewBox', [0, 0, width, height]);

		const margin = {top: 0,
										left: 0,
										bottom: 20,
										right: 0};

		this._x = d3.scaleLinear()
			.range([margin.left, width - margin.right]);

		this._y = d3.scaleLinear()
			.domain([-1, 1])
			.range([height - margin.bottom, margin.top]);

		this._d3.append('g')
			.attr('class', 'x-axis axis')
			.attr('transform', `translate(0, ${height - margin.bottom})`)
			.call( d3.axisBottom().scale(this._x).ticks(0) );

		this._d3.append('g')
			.attr('class', 'y-axis axis')
			.attr('transform', `translate(${margin.left}, 0)`)
			.call( d3.axisLeft().scale(this._y).ticks(1).tickSize(-width) );

		this._line = d3.line()
			.x( (d, i) => this._x(i))
			.y( (d) => this._y(d));

		this._allSeries = [];
		this._maxSeriesLength = 0;

		this._seriesGroup = this._d3.append('g')
			.attr('class', 'seriesGroup');
	}

	redrawAllSeries() {
		this._x.domain( [0, this._maxSeriesLength] );

		for (let series of this._allSeries)
			series.path.attr('d', this._line);
	}

	plot(name, data, color) {
		if (data.length > this._maxSeriesLength) {
			this._maxSeriesLength = data.length;
			this.redrawAllSeries();
		}

		const path = this._seriesGroup
					.append('path')
					.attr('class', 'series')
					.attr("stroke", color)
					.datum(data)
					.attr('d', this._line);

		const series = {
			name: name,
			data: data,
			color: color,
			path: path,
			update: (data) => {
				if (data.length > this._maxSeriesLength) {
					this._maxSeriesLength = data.length;
					this.redrawAllSeries();
				}
				path.datum(data).attr('d', this._line);
			}
		};

		this._allSeries.push(series);
		return series;
	}
}

$( () => {

	const signal = new Array(2048);
	signal.fill(0);

	for (let t = 0 ; t < signal.length ; ++t)
		signal[t] += 0.5 * Math.sin(t / 60);

	for (let t = 0 ; t < signal.length ; ++t)
		signal[t] += 0.3 * Math.sin(t / 30);

	for (let t = 0 ; t < signal.length ; ++t)
		signal[t] += 0.2 * Math.sin(t / 15);

	const signalChart = new Chart('#signal');
	dbg.signalChart = signalChart;
	const signalSeries = signalChart.plot('Signal', signal, 'steelblue');

	tf.tidy('test', () => {
		const tSignal = tf.tensor1d(signal);
		const tLagged = tSignal.slice(30).pad([[0, 30]]);

		const tProducts = tSignal.mul(tLagged);

		tLagged.data().then( (data) => { signalChart.plot('Shifted signal', data, 'burlyWood'); } );
		tProducts.data().then( (data) => { signalChart.plot('Products', data, 'crimson'); } );
	});

});
