Lyte.Component.register("graph-config-editor", {
	data: function () {
		return {
			graphId: Lyte.attr('string', {}),
			activeNodeData: Lyte.attr('object', {
				default: {}
			}),
			overallNodes: Lyte.attr('object', {
				default: {}
			}),
			nodeTypes: Lyte.attr('array', {
				default: [
					{
						key: "node",
						value: "Node"
					},
					{
						key: "parallel",
						value: "Parallel"
					},
					{
						key: "condition",
						value: "Condition"
					},
					{
						key: "switch",
						value: "Switch"
					},
					{
						key: "success",
						value: "Success"
					},
					{
						key: "failure",
						value: "Failure"
					}
				]
			}),
			editorData: Lyte.attr('object', {
				default: {
					name: '',
					type: '',
					next: [{ value: "--None--", key: "None" }],
					selectedNext: [{ value: "--None--", key: "None" }]
				}
			}),
			showEditingForm: Lyte.attr('boolean', {
				default: true
			}),
			onEditState: Lyte.attr('boolean', {
				default: false
			})
		}
	},
	init: function () {
		// console.log(this);
	},
	didConnect: function () {
		// console.log(this.data.graphObject);
	},
	actions: {
		editDetails: function () {
			this.setData('onEditState', true);
		},
		discardChanges: function () {
			this.setData('onEditState', false);
			this.actions.activeNodeChange(this.data.graphId, this.data.activeNodeData);
		},
		saveChanges: function () {
			let updates = []
			// console.log(this.data.editorData);
			if (this.data.editorData.selectedNextPrev !== this.data.editorData.selectedNext) {
				updates.push('next')
			}
			this.throwEvent('on-node-update', {
				updates: updates,
				graphId: this.data.graphId,
				editData: this.data.editorData,
				origData: this.data.activeNodeData
			});
			this.methods.resetToDefault.call(this);
		},
		activeNodeChange: function (graphId, activeNode, nodes) {
			console.log(activeNode);
			activeNode = Lyte.deepCopyObject(activeNode);
			let obj = {
				name: activeNode.data.label,
				type: activeNode.type,
				next: [],
				selectedNext: ''
			}
			if (activeNode.next.length > 0) {
				obj.selectedNext = activeNode.successor;
				obj.next.push(obj.selectedNext);
			} else {
				obj.next.push("--None--");
				obj.selectedNext = "--None--";
			}
			if (activeNode.futureNext && activeNode.futureNext.length > 0) {
				activeNode.futureNext.forEach(next => {
					obj.next.push(next);
				});
			}

			obj["selectedNextPrev"] = obj.selectedNext;
			this.setData('editorData', obj);
			this.setData('graphId', graphId);
			this.setData('activeNodeData', activeNode);
		},
		// Functions for event handling
	},
	methods: {
		resetToDefault: function () {
			this.setData('onEditState', false);
		},
		editModeChange: function (oldValue, newValue) {
			if (newValue === 'form') {
				this.setData('showEditingForm', true);
			} else {
				this.setData('showEditingForm', false);
			}
		},
		updateSelection: function (event, currentSelected, component, dropItem) {
			this.data.editorData.selectedNext = currentSelected;
		},

		// Functions which can be used as callback in the component.
	}
});
