Lyte.Component.register("graph-canvas", {
	data: function () {
		return {
			graphObject: Lyte.attr('object', {}),
		}
	},
	init: function () {
	},
	didConnect: function () {
		this.data.graphObject.renderGraph();
	},
	actions: {
		// Functions for event handling
	},
	methods: {
		// Functions which can be used as callback in the component.
	}
});
