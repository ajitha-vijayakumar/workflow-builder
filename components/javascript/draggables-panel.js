Lyte.Component.register("draggables-panel", {
	data: function () {
		return {
			draggables: Lyte.attr('object', {
				default: {
					"node": {
						id: "#node",
						name: "Node ",
						newCount: 0
					},
					"parallel": {
						id: "#parallel",
						name: "Parallel ",
						newCount: 0
					},
					"switch": {
						id: "#switch",
						name: "Switch ",
						newCount: 0
					},
					"condition": {
						id: "#condition",
						name: "Condition ",
						newCount: 0
					},
					"success": {
						id: "#success",
						name: "Success ",
						newCount: 0
					},
					"failure": {
						id: "#failure",
						name: "Failure ",
						newCount: 0
					}
				}
			}),
		}
	},
	didConnect: () => {
		let leftPanelIns = document.querySelector('draggables-panel').component;
		window.leftPanelIns = leftPanelIns;
		leftPanelIns.methods.makeOptionsDraggable();
	},
	actions: {
		// Functions for event handling

	},
	methods: {
		makeOptionsDraggable() {
			let leftPanelIns = window.leftPanelIns;
			for (const key in leftPanelIns.data.draggables) {
				let draggable = leftPanelIns.data.draggables[key];
				$L(draggable.id).draggable({
					helper: function (elem) {
						if (('#' + elem.id) !== draggable.id) {
							return elem;
						}
						leftPanelIns.setData(`draggables.${key}.newCount`, draggable.newCount + 1);
						let newElem = elem.cloneNode(true);
						newElem.id = draggable.name + (draggable.newCount);
						newElem.innerText = newElem.id;
						newElem.style.border = '1px solid #ccc';
						newElem.style.padding = '0.5vw';
						newElem.style.width = 'fit-content';
						newElem.style.whiteSpace = 'nowrap';
						newElem.dataset.type = key;
						return newElem;
					},
					onStop: function (element, destination, belowElement, Event, index) {
						element.parentElement.removeChild(element);
					}
				});
			}
		},
		// Functions which can be used as callback in the component.
	}
});
