$( () => {
	console.log("ready");

	const vf = Vex.Flow;
	const staffContainer = $("#staff2")[0];
	const renderer = new vf.Renderer(staffContainer, vf.Renderer.Backends.SVG);

	const context = renderer.getContext();
	const stave = new vf.Stave(0, 0, 100);
	stave.addClef("treble");
	stave.setContext(context).draw();

	var voice = new vf.Voice({num_beats: 1,  beat_value: 4});
	voice.addTickables([new vf.StaveNote({clef: "treble", keys: ["c/5"], duration: "q" })]);

	// Format and justify the notes to 400 pixels.
	var formatter = new vf.Formatter().joinVoices([voice]).format([voice], 400);

	// Render voice
	voice.draw(context, stave);


	// using EasyScore
	const vf3 = new Vex.Flow.Factory({renderer: {elementId: 'staff3'}});
	const score = vf3.EasyScore();
	const system = vf3.System();
	
	system.addStave({
		voices: [score.voice(score.notes('C5/q, B4/2/r.'))]
	}).addClef('treble');

	vf3.draw();
});










