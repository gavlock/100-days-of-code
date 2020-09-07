export class Debug {

	constructor() {
		this.logContainer = null;
		this.watch = {};
	}

	setLogContainer(jquery) {
		this.logContainer = jquery.length ? jquery : null;
	};

	_logImpl(cssClass, consoleFunction, ...args) {
		const message = args.join(' ');

		consoleFunction(message);

		if (this.logContainer)
			$('<p>').addClass(cssClass)
			        .text(message)
							.appendTo(this.logContainer);
	};
	
	log(...args) { this._logImpl('info', console.info, ...args); }

	error(...args) { this._logImpl('error', console.error, ...args); }
}

