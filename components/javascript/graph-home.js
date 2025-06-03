Lyte.Component.register("graph-home", {
	data: function () {
		return {
			graphData: Lyte.attr("array", {
				default: [{
					id: "Graph1",
					conf: {
						"Start": {
							type: "node",
							next: "Parallel One",
							data: { shape: "circle", label: "Start", style: "fill:#ffea00;stroke:none" }
						},
						"Parallel One": {
							type: "parallel",
							data: { label: "Parallel One", clusterLabelPos: "top", style: "fill: #d3d7e878" },
							startNode: {
								type: "node",
								data: { shape: "ellipse", label: "Par 1 Start" }
							},
							paths: [
								{
									"Parallel Two": {
										type: "parallel",
										start: true,
										data: { label: "Parallel Two", clusterLabelPos: "top", style: "fill: #c3fbff78" },
										startNode: {
											type: "node",
											data: { shape: "ellipse", label: "Par 2 Start" }
										},
										paths: [
											{
												"P11": {
													type: "node",
													next: "P11a",
													start: true,
													data: { shape: "ellipse", label: "P11" }
												},
												"P11a": {
													type: "node",
													next: null,
													end: true,
													data: { shape: "ellipse", label: "P11a" }
												},
											}, {
												"P12": {
													type: "node",
													next: "P12a",
													start: true,
													data: { shape: "ellipse", label: "P12" }
												},
												"P12a": {
													type: "node",
													next: null,
													end: true,
													data: { shape: "ellipse", label: "P12a" }
												},
											}
										],
										next: "Par 2 End"
									},
									"Par 2 End": {
										type: "node",
										next: null,
										end: true,
										data: { shape: "ellipse", label: "Par 2 End" }
									},
								}, {
									"P2": {
										type: "node",
										next: "P2a",
										start: true,
										data: { shape: "ellipse", label: "P2" }
									},
									"P2a": {
										type: "node",
										next: null,
										end: true,
										data: { shape: "ellipse", label: "P2a" }
									},
								}
							],
							next: "Par 1 End"
						},
						"Par 1 End": {
							type: "node",
							next: "Condition One",
							data: { shape: "ellipse", label: "Par 1 End" }
						},
						"Condition One": {
							type: "condition",
							next: "Cond 1 End",
							result: {
								trueNext: "T1",
								falseNext: "F1"
							},
							data: { shape: "diamond", label: "Condition One" }
						},
						"T1": {
							type: "node",
							next: "Cond 1 End",
							data: { shape: "ellipse", label: "T1" }
						},
						"F1": {
							type: "node",
							next: "Cond 1 End",
							data: { shape: "ellipse", label: "F1" }
						},
						"Cond 1 End": {
							type: "node",
							next: "Swit One",
							data: { shape: "ellipse", label: "Cond 1 End" }
						},
						"Swit One": {
							type: "switch",
							next: "Swit 1 End",
							cases: [
								{
									case: "",
									next: "C1"
								},
								{
									case: "",
									next: "C2"
								},
								{
									case: "default",
									next: "Default"
								}
							],
							data: { shape: "ellipse", label: "Swit One" }
						},
						"C1": {
							type: "node",
							next: "Swit 1 End",
							data: { shape: "ellipse", label: "C1" }
						},
						"C2": {
							type: "node",
							next: "Swit 1 End",
							data: { shape: "ellipse", label: "C2" }
						},
						"Default": {
							type: "node",
							next: "Swit 1 End",
							data: { shape: "ellipse", label: "Default" }
						},
						"Swit 1 End": {
							type: "node",
							next: "End",
							data: { shape: "ellipse", label: "Swit 1 End" }
						},
						"End": {
							type: "node",
							next: null,
							data: { shape: "circle", label: "End", style: "fill:#ffea00;stroke:none" }
						}
					}
				}]
			}),
			graphObjects: Lyte.attr("object", {
				default: {}
			}),
			activeNodes: Lyte.attr("object", {
				default: {}
			}),
			formattedGraphData: Lyte.attr("string", {
				default: "",
				hideAttr: true
			}),
			focused: Lyte.attr("object", {
				default: {
					name: "",
					type: "",
					next: [{ nodeId: "--None--", key: "None" }],
					selectedNext: [{ nodeId: "--None--", key: "None" }]
				}
			}),
			draggables: Lyte.attr("object", {
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
	didConnect: function () {
		this.actions.initQGraphs.call(this);
	},
	actions: {
		initQGraphs: function () {
			let self = this;
			self.data.graphData.forEach(graph => {
				var obj = new QGraph1({
					graphData: Lyte.deepCopyObject(graph.conf),
					componentIns: this,
					isCompound: true,
					graphId: graph.id,
				});
				Lyte.objectUtils(self.data.graphObjects, "add", graph.id, obj);
				Lyte.objectUtils(self.data.activeNodes, "add", graph.id, self.data.graphObjects[graph.id].activeNode);
			});

		},
		render: function () {
			let data = document.querySelector("#content #code #codeInput").ltProp("value");
			let graphData = JSON.parse(data);
			this.setData("graphData", graphData);
			this.methods.renderGraph();
		},
		updateGraphData: function (graphData, graphId) {
			let matchIndex = -1;
			for (const index in this.data.graphData) {
				if (this.data.graphData[index].id === graphId) {
					matchIndex = index;
					break;
				}
			}
			if (matchIndex !== -1) {
				this.methods.setFormattedData(graphData);
				Lyte.objectUtils(this.data.graphData[matchIndex], "delete", "conf");
				Lyte.objectUtils(this.data.graphData[matchIndex], "add", "conf", graphData);
			}
		},
		updateNodeData: function (data) {
			if (data.updates.indexOf('next') !== -1) {
				// console.log('next change',data);
				this.data.graphObjects[data.graphId].update.next(
					data.origData.data.label,
					data.editData.selectedNextPrev,
					data.editData.selectedNext);
			}
			if (data.updates.indexOf("name") !== -1) {
				console.log("name change", data);
			}
		}
		// Functions for event handling
	},
	methods: {

		setFormattedData: function (data) {
			let strObj = JSON.stringify(data, null, 4)
			let compIns = document.querySelector("graph-home").component;
			compIns.setData("formattedGraphData", strObj);
			// console.log(compIns.data.formattedGraphData);
		},

		// Functions which can be used as callback in the component.
	},

});
