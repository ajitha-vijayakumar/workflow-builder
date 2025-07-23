class QGraph {
    constructor(confData) {
        // parameters to be given inside confData at the time of initialization 
        // mandatory : 
        // graphId, 
        // graphOutletDiv (id of the div inside which the graph will be rendered)
        // dragTypeVarName - name of the global variable that is going to hold the type of the node being dragged
        // callbackFunctions
        //     - activeNodeChangeCallback : to be called when activeNodeChange event is triggered
        //     - graphConfChangeCallback : to be called when graphConfChange event is triggered
        // optional : 
        //  graphData (conf of graph, 
        //   - if its not gn a default conf with only start and end node will be generated)
        this._graphStart = 'Start';
        this._graphEnd = 'End'
        this._graphDefaults = {
            start: this._graphStart,
            end: this._graphEnd,
            conf: {
                [this._graphStart]: {
                    type: "node",
                    next: this._graphEnd,
                    id: `${this._graphStart}`,
                },
                [this._graphEnd]: {
                    type: "node",
                    next: null,
                    id: `${this._graphEnd}`,
                }
            },
            activeNode: {},
            undoStack: [],
            redoStack: [],
            isInitialLoad: true,
            currentZoomTransform: null,
            draggables: {
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
            },
        }
        this.graphId = confData.graphId;
        this.graphConf = confData.graphData && (Object.keys(confData.graphData).length > 0) ? JSON.parse(JSON.stringify(confData.graphData)) : JSON.parse(JSON.stringify(this._graphDefaults.conf));

        this.graphOutletDiv = confData.graphOutletDiv;
        this.graph = null;
        this.nodes = {};
        this.activeNode = {};
        this.dragTypeVarName = confData.dragTypeVarName;
        if (confData.activeNodeChangeCallback)
            this._activeNodeLisId = this.EventBus.addEventListener('activeNodeChange', confData.activeNodeChangeCallback);
        if (confData.graphConfChangeCallback)
            this._graphConfLisId = this.EventBus.addEventListener('graphConfChange', confData.graphConfChangeCallback);
    }
    validator = {
        validateEdgeCreation: (fromId, toId, toNodeType) => {
            if (!toNodeType && toId) {
                toNodeType = this.getNode(toId).type;
            }
            if (toId === this._graphStart || fromId === this._graphEnd) {
                return false;
            } else if (toNodeType === "success" || toNodeType === "failure") {
                return (fromId === this._graphStart ||
                    (this.validator.isParallelChild(fromId)
                        && this.validator.isParallelChild(toId))
                ) ? false : true;
            } else {
                return true;
            }
        },
        isParallelChild: (nodeId) => {
            let parent = this.getNode(nodeId).parent;
            return (parent && this.getNode(parent).type === "parallel") ? true : false;
        }
    }
    update = {
        add: (id, type, from, to) => {
            let fromNodeData = this.getNode(from);
            let toNodeData = this.getNode(to);
            if (toNodeData.parallelStart) {
                to = toNodeData.parent;
            }
            let newNodes = this._fetchData.newNode(type, id, to);
            let fromNodeObj = fromNodeData.nodeConf;
            if (fromNodeData.parent) {
                let parent = this.getNode(fromNodeData.parent);
                if (fromNodeData.parallelStart) {
                    if (toNodeData.parallelEnd) {
                        this.update._addNewPath(parent.nodeConf.paths, newNodes);
                    } else {
                        let path = this._fetchData.findParentPath(to, parent.nodeConf);
                        this.update._prependToPath(newNodes, path);
                    }
                } else if (fromNodeData.parallelEnd && !parent.parent) {
                    parent = this._fetchData.parentNode(parent.id);
                    // from node is a end of parallel and it is not inside any parallel
                    for (const nodeId in newNodes) {
                        parent[nodeId] = newNodes[nodeId];
                    }
                    fromNodeObj["next"] = id;
                } else {
                    if (fromNodeData.parallelEnd) {
                        parent = this.getNode(parent.parent);
                    }
                    if (toNodeData.parallelEnd) {
                        for (const nodeId in newNodes) {
                            if (newNodes[nodeId].next === to) {
                                newNodes[nodeId].next = null;
                                newNodes[nodeId].end = true;
                            }
                        }
                        delete fromNodeObj["end"];
                    }

                    let pathToAdd = this._fetchData.findParentPath(from, parent.nodeConf);
                    for (const nodeId in newNodes) {
                        pathToAdd[nodeId] = newNodes[nodeId];
                    }
                    if (fromNodeData.type === "condition") {
                        this.update._updateParentCondition(to, id, fromNodeObj);
                    } else if (fromNodeData.type === "switch") {
                        this.update._updateParentSwitch(to, id, fromNodeObj);
                    } else {
                        fromNodeObj["next"] = id;
                    }
                }
            } else {
                for (const nodeId in newNodes) {
                    this.graphConf[nodeId] = newNodes[nodeId];
                }
                if (fromNodeData.type === "node") {
                    fromNodeObj["next"] = id;
                } else if (fromNodeData.type === "condition") {
                    this.update._updateParentCondition(to, id, fromNodeObj);
                } else if (fromNodeData.type === "switch") {
                    this.update._updateParentSwitch(to, id, fromNodeObj);
                }

            }
            this.renderGraph();
            this.activeNode = this.getNode(id);
            this.setActiveNode(id);
            this._historyManager.updateStateInStack();
        },
        rename: (id, newId) => {
            let nodeObj = this.getNode(id);
            let parent = nodeObj.parent;
            if (parent) {
                if (nodeObj.parallelEnd) {
                    let parentObj = this.getNode(parent);
                    let editParent = this._fetchData.parentNode(parent);

                    let parentsParent = parentObj.parent;
                    if (parentsParent) {
                        editParent = this.getNode(parentsParent).nodeConf.paths[parentObj.pathIndex];
                    }

                    editParent[newId] = editParent[id];
                    editParent[newId].id = newId;
                    delete editParent[id];
                } else if (nodeObj.parallelStart) {
                    nodeObj.nodeConf.id = newId;
                } else {
                    let pathIndex = nodeObj.pathIndex;
                    if (pathIndex >= 0) {
                        let path = this.getNode(parent).nodeConf.paths[pathIndex];
                        path[newId] = path[id];
                        path[newId].id = newId;
                        delete path[id];
                    }
                }
            } else {
                let overAllParent = this._fetchData.parentNode(id);
                overAllParent[newId] = overAllParent[id];
                overAllParent[newId].id = newId;
                delete overAllParent[id];
            }
            if (nodeObj.parallelEnd) {
                this.getNode(parent).nodeConf.next = newId;
            } else if (!nodeObj.parallelStart) {
                if (nodeObj.switchEnd) {
                    this.getNode(nodeObj.switchId).nodeConf.next = newId;
                } else if (nodeObj.conditionEnd) {
                    this.getNode(nodeObj.conditionId).nodeConf.next = newId;
                }
                nodeObj.previous.forEach(prevId => {
                    let prevObj = this.getNode(prevId);
                    if (prevObj.type === 'node' && prevObj.next && !prevObj.parallelStart) {
                        prevObj.nodeConf.next = newId;
                    } else if (prevObj.type === 'switch') {
                        this.update._updateParentSwitch(id, newId, prevObj);
                    } else if (prevObj.type === 'condition') {
                        this.update._updateParentCondition(id, newId, prevObj);
                    }
                });
            }
            this.renderGraph();
            this.activeNode = this.getNode(newId);
            this.setActiveNode(newId);
            this._historyManager.updateStateInStack();
        },
        next: (id, previousTo, newto) => {
            this.update._deepNextUpdate(id, previousTo, newto);
            this.renderGraph();
            this._historyManager.updateStateInStack();
        },
        replaceGraphConf: (newGraphConf) => {
            this.graphConf = newGraphConf;
            this._historyManager.updateStateInStack();
            this.graphConf = JSON.parse(JSON.stringify(newGraphConf));
            this.renderGraph();
        },
        delete:(id) =>{
            let nodeObj = this.getNode(id);
            if(!nodeObj){
                console.error(`Node ${id} does not exists`);
                return;
            }
            if(nodeObj.parallelStart){
                const userConfirmed = confirm("Deleting this node will delete the entire cluster. Do you want to proceed?");
                if(userConfirmed){
                    this.update.delete(nodeObj.parent);
                    return;
                }else{
                    return;
                }
            }
            if(nodeObj.parallelEnd || nodeObj.switchEnd || nodeObj.conditionEnd){
                let parent = nodeObj.parallelEnd ? nodeObj.parent : (nodeObj.switchEnd ? nodeObj.switchId : nodeObj.conditionId);
                alert(`This node is an end node. So, it can't be deleted until the parent "${parent}" is deleted`);
                return;
            }
            let successor = (nodeObj.type === 'parallel') ? nodeObj.endNode : 
                            (nodeObj.type === 'switch') ? nodeObj.end :
                            (nodeObj.type === 'condition') ? nodeObj.end : 
                            (this.getNode(nodeObj.successor).parallelStart) ? this.getNode(nodeObj.successor).parent :
                            nodeObj.successor;

            nodeObj.predecessors && nodeObj.predecessors.forEach(predecessor => {
                let predObj = this.getNode(predecessor);
                if(predObj.type === 'switch' && predObj.end !== id){
                    this.update._updateParentSwitch(id, successor, predObj);
                }else if(predObj.type === "condition" && predObj.end !== id){
                    this.update._updateParentCondition(id, successor, predObj);
                }else
                    predObj.nodeConf.next = successor;
            });

            let parent = nodeObj.parent;
            if (parent) {
                let pathIndex = nodeObj.pathIndex;
                if (pathIndex >= 0) {
                    let path = this.getNode(parent).nodeConf.paths[pathIndex];
                    if(Object.keys(path).length === 1){
                        delete this.getNode(parent).nodeConf.paths.splice(pathIndex,1);
                    }else{
                        delete path[id];
                        let successorObj = this.getNode(successor);
                        if(nodeObj.start){
                            successorObj.nodeConf.start = true; 
                        }
                    }
                }
            } else {
                let overAllParent = this._fetchData.parentNode(id);
                delete overAllParent[id];
            }

            this.renderGraph();
            this.activeNode = this.getNode(successor);
            this.setActiveNode(successor);
            this._historyManager.updateStateInStack();
            
        },
        _deepNextUpdate: (from, previousTo, to) => {
            if (!this.validator.validateEdgeCreation(from, to) || !to || !from)
                return

            let fromData = this.getNode(from);
            let toData = this.getNode(to);
            let toCopy = to;
            if (toData.parallelStart) {
                toCopy = toData.parent;
            }
            if (fromData.parallelStart) {
                let parallelEnd = this.getNode(this.getNode(fromData.parent).endNode);
                parallelEnd.nodeConf.next = toCopy;
            } else if (fromData.type === 'parallel') {
                let parallelEnd = this.getNode(fromData.endNode);
                parallelEnd.nodeConf.next = toCopy;
            } else if (fromData.type === 'condition' || fromData.type === 'switch') {
                let branchEnd = this.getNode(fromData.nodeConf.next);
                branchEnd.nodeConf.next = toCopy;
            } else {
                fromData.nodeConf.next = toCopy;
            }

            if (fromData.insideSwitch && !toData.insideSwitch) {
                if (previousTo)
                    this.update._deepNextUpdate(to, '', previousTo);

                let toIndex = fromData.futureNext.indexOf(to);
                if (toIndex !== -1) {
                    let toSuccessor = toData.successor;
                    let toPredecessor = (toIndex === 0) ? fromData.switchExitNode : fromData.futureNext[toIndex - 1];
                    this.update._deepNextUpdate(toPredecessor, '', toSuccessor);
                }
            }
        },
        _addNewPath(paths, newNodes) {
            newNodes[Object.keys(newNodes)[0]].start = true;
            if (Object.keys(newNodes).length > 1) {
                let lastNode = newNodes[Object.keys(newNodes)[Object.keys(newNodes).length - 1]];
                lastNode.end = true;
                lastNode.next = null;
            } else {
                newNodes[Object.keys(newNodes)[0]].end = true;
                newNodes[Object.keys(newNodes)[0]].next = null;
            }
            paths.push(newNodes);
        },
        _prependToPath(newNodes, pathToAdd) {
            let firstNodeId = null;
            let lastNodeId = null;
            for (const nodeId in pathToAdd) {
                if (pathToAdd[nodeId].start) {
                    firstNodeId = nodeId;

                }
                if (pathToAdd[nodeId].end) {
                    lastNodeId = nodeId;
                }
            }
            if (firstNodeId) {
                delete pathToAdd[firstNodeId]["start"];
                newNodes[Object.keys(newNodes)[0]].start = true;
                if (newNodes[Object.keys(newNodes)[0]].type === "success" || newNodes[Object.keys(newNodes)[0]].type === "failure") {
                    newNodes[Object.keys(newNodes)[0]].end = true;
                    delete pathToAdd[lastNodeId]["end"];
                }
                for (const nodeId in newNodes) {
                    pathToAdd[nodeId] = newNodes[nodeId];
                }
            }
        },
        _updateParentCondition(from, to, conditionConf) {
            if (conditionConf.result.trueNext === from) {
                conditionConf.result.trueNext = to;
            } else if (conditionConf.result.falseNext === from) {
                conditionConf.result.falseNext = to;
            }
        },
        _updateParentSwitch(from, to, switchConf) {
            let cases = switchConf.cases;
            let isInside = (from !== switchConf.next);
            if (isInside) {
                for (const caseIndex in cases) {
                    if (cases[caseIndex].next === from) {
                        cases[caseIndex].next = to;
                        isInside = true;
                        break;
                    }
                }
            } else {
                let caseNumber = cases.length;
                cases.push({
                    case: `Case ${caseNumber}`,
                    next: to
                });

            }
        },
    }
    _fetchData = {
        newNode: (type, id, to) => {
            if (type === "node") {
                return {
                    [id]: {
                        type: type,
                        next: to,
                        id: id,
                        payload: {}
                    }
                };
            } else if (type === "parallel") {
                return {
                    [id]: {
                        type: "parallel",
                        id: id,
                        startNode: {
                            type: "node",
                            id: id + " start",
                            payload: {}
                        },
                        paths: [],
                        next: id + " end"
                    },
                    [id + " end"]: {
                        type: "node",
                        next: to,
                        id: id + " end",
                        payload: {}
                    }
                };
            } else if (type === "condition") {
                return {
                    [id]: {
                        type: "condition",
                        next: id + " end",
                        result: {
                            trueNext: id + " TPath",
                            falseNext: id + " FPath"
                        },
                        id: id,
                        payload: {}
                    },
                    [id + " TPath"]: {
                        type: "node",
                        next: id + " end",
                        id: id + " TPath",
                        payload: {}
                    },
                    [id + " FPath"]: {
                        type: "node",
                        next: id + " end",
                        id: id + " FPath",
                        payload: {}
                    },
                    [id + " end"]: {
                        type: "node",
                        next: to,
                        id: id + " end",
                        payload: {}
                    }
                }
            } else if (type === "switch") {
                return {
                    [id]: {
                        type: "switch",
                        next: id + " end",
                        cases: [{
                            case: "default",
                            next: id + " Default"
                        }],
                        id: id,
                        payload: {}
                    },
                    [id + " Default"]: {
                        type: "node",
                        next: id + " end",
                        id: id + " Default",
                        payload: {}
                    },
                    [id + " end"]: {
                        type: "node",
                        next: to,
                        id: id + " end",
                        payload: {}
                    }
                }
            } else if (type === "success" || type === "failure") {
                return {
                    [id]: {
                        type: type,
                        next: null,
                        id: id,
                        payload: {}
                    }
                }
            }
        },
        parentNode: (nodeId) => {
            let nodeObj = this.getNode(nodeId);
            let searchNode = nodeObj.parent;
            if (nodeObj.parallelEnd)
                searchNode = this.getNode(searchNode).parent;
            if (searchNode)
                return this.getNode(searchNode).nodeConf;
            return this.graphConf;
        },
        successorId: (nodeId, nodeConf, parentConf) => {
            let successor = nodeConf.next;
            if (!successor) {
                let parent = this.getNode(nodeId).parent;
                successor = parent ? this.getNode(parent).endNode : null;
            } else if (parentConf[successor] && parentConf[successor].type === 'parallel') {
                successor = parentConf[successor].startNode.id;
            }

            return successor;
        },
        newNodeId: (type) => {
            let id = '';
            let nameDetailsObj = this._graphDefaults.draggables[type];
            nameDetailsObj.newCount++;
            while (this.getNode(nameDetailsObj.name + (nameDetailsObj.newCount))) {
                nameDetailsObj.newCount++;
            }
            id = nameDetailsObj.name + (nameDetailsObj.newCount);
            return id;
        },
        findParentPath: (nodeId, parent) => {
            for (const pathIndex in parent.paths) {
                if (parent.paths[pathIndex][nodeId]) {
                    return parent.paths[pathIndex];
                }
            }
            return null;
        },
        next: (id) => {
            let data = this.getNode(id);
            let next = ''
            if (data.parallelStart || data.parallelEnd || data.parent) {
                let parentNext = this.getNode(data.parent).nodeConf.next;
                next = this.getNode(parentNext).nodeConf.next;
            } else if (data.type === "switch" || data.type === "condition" || data.type === "parallel")
                next = this.getNode(data.nodeConf.next).nodeConf.next;
            else {
                next = data.nodeConf.next;
            }
            if (next && this.getNode(next).type === 'parallel') {
                next = this.getNode(next).startNode;
            }
            return next;
        },
        nodeObject: (nodeType, nodeConf, parentConf) => {
            let nodeObject = {
                type: nodeConf.type,
                id: nodeConf.id,
                parent: (parentConf.id) ? parentConf.id : null,
                data: { shape: "rect", label: `${nodeConf.id}` },
                children: [],
                previous: [],
                next: [],
                payload: nodeConf.payload ? nodeConf.payload : {},
                nodeConf: nodeConf
            };
            switch (nodeType) {
                case 'parallel':
                    nodeObject.startNode = nodeConf.startNode.id;
                    nodeObject.endNode = nodeConf.next;
                    nodeObject.data.clusterLabelPos = "top";
                    nodeObject.data.style = "fill: #d3d7e878";
                    break;
                case 'parallelStart':
                    nodeObject.type = "node";
                    nodeObject.id = nodeConf.startNode.id;
                    nodeObject.data.label = nodeConf.startNode.id;
                    nodeObject.parent = nodeConf.id;
                    nodeObject.nodeConf = nodeConf.startNode;
                    nodeObject.parallelStart = true;
                    nodeObject.next = [nodeConf.next];
                    break;
                case 'switch':
                    nodeObject.cases = nodeConf.cases;
                    nodeObject.end = nodeConf.next;
                    break;
                case 'condition':
                    nodeObject.result = nodeConf.result;
                    nodeObject.end = nodeConf.next;
                    break;
                case 'success':
                    nodeObject.data.shape = 'circle';
                    nodeObject.data.style = "fill :#00da0082"
                    break;
                case 'failure':
                    nodeObject.data.shape = 'circle';
                    nodeObject.data.style = "fill :#ff0000a6"
                    break;
            }
            if (nodeObject.id === this._graphStart || nodeObject.id === this._graphEnd) {
                nodeObject.data.shape = "circle";
                nodeObject.data.style = "fill :#ffea00";
            }
            // if(nodeObject) start and end node styling
            return nodeObject;
        }
    }
    _updatenodesObject = {
        push: (nodeId, key, valueToPush) => {
            let node = this.getNode(nodeId);
            if (!node)
                return;
            if (!node[key])
                node[key] = [];
            node[key].push(valueToPush);
        },
        pushIfNew: (nodeId, key, valueToPush) => {
            let node = this.getNode(nodeId);
            if (!node || !valueToPush)
                return;
            if (!node[key])
                node[key] = [];

            if (node[key].indexOf(valueToPush) === -1)
                node[key].push(valueToPush);
        },
        setValue: (nodeId, key, value) => {
            let node = this.getNode(nodeId);
            if (!node)
                return;
            node[key] = value;
        },
        addFutureNext: (nodeId, futureNexts) => {
            let node = this.getNode(nodeId);
            if (!nodeId || !node || !futureNexts || futureNexts.length === 0)
                return
            let nodeObj = node;
            if (!nodeObj.futureNext) {
                nodeObj.futureNext = [];
            }
            let arrToAdd = futureNexts.filter(next => (nodeObj.futureNext.indexOf(next) === -1));
            if (nodeObj.insideSwitch && arrToAdd.indexOf(this._graphEnd) !== -1) {
                arrToAdd.splice(arrToAdd.indexOf(this._graphEnd), 1);
            }
            node.futureNext.push(...arrToAdd);
        },
        setPredecessors: ()=>{
           for (const nodeId in this.nodes ) {
                let successor = this.getNode(nodeId).successor;
                let successorObj = this.getNode(successor);
                if (successor && successorObj) {
                    let nodeObj = this.getNode(nodeId);
                    if(successorObj.parallelEnd){
                        this._updatenodesObject.pushIfNew(successor,"predecessors",successorObj.parent);
                    }else if(!nodeObj.parallelStart 
                        && nodeObj.type !== 'parallel'
                        && nodeObj.type !== 'switch'
                        && nodeObj.type !== 'condition'
                    ){
                        if (successorObj.switchEnd) {
                            this._updatenodesObject.pushIfNew(successor,"predecessors",successorObj.switchId);
                        } else if (successorObj.conditionEnd) {
                            this._updatenodesObject.pushIfNew(successor,"predecessors",successorObj.conditionId);
                        } else if(successorObj.parallelStart){
                            this._updatenodesObject.pushIfNew(successorObj.parent,"predecessors",nodeId);
                        }
                        this._updatenodesObject.pushIfNew(successor,"predecessors",nodeId);
                    }else if(nodeObj.type === 'switch'){
                        nodeObj.cases.forEach(caseObj => {
                            this._updatenodesObject.pushIfNew(caseObj.next,"predecessors",nodeId);
                        });
                    }else if(nodeObj.type === 'condition'){
                        this._updatenodesObject.pushIfNew(nodeObj.result.trueNext,"predecessors",nodeId);
                        this._updatenodesObject.pushIfNew(nodeObj.result.falseNext,"predecessors",nodeId);
                    }
                }
            }
        }
    }
    _historyManager = {
        handleUndoClick: () => {
            if (this._graphDefaults.undoStack.length <= 1) return;
            const currentState = this._graphDefaults.undoStack.pop();
            this._graphDefaults.redoStack.push(currentState);
            this.graphConf = JSON.parse(JSON.stringify(this._graphDefaults.undoStack[this._graphDefaults.undoStack.length - 1]));
            this.renderGraph();
            this._historyManager.updateStackCount();
            document.querySelector(`#${this.graphOutletDiv} .actions #reCenter`).click();
        },
        handleRedoClick: () => {
            if (this._graphDefaults.redoStack.length === 0) return;
            const nextState = this._graphDefaults.redoStack.pop();
            this._graphDefaults.undoStack.push(nextState);
            this.graphConf = JSON.parse(JSON.stringify(nextState));
            this.renderGraph();
            this._historyManager.updateStackCount();
            document.querySelector(`#${this.graphOutletDiv} .actions #reCenter`).click();
        },
        handleResetClick: () => {
            this.graphConf = JSON.parse(JSON.stringify(this._graphDefaults.conf));
            this.renderGraph();
            this._historyManager.updateStateInStack();
            document.querySelector(`#${this.graphOutletDiv} .actions #reCenter`).click();
        },
        updateStackCount: () => {
            let actions = document.querySelector(`#${this.graphOutletDiv} .actions`);
            let undoCount = this._graphDefaults.undoStack.length - 1;
            let redoCount = this._graphDefaults.redoStack.length;
            actions.querySelector("#undo #count").innerText = undoCount;
            actions.querySelector("#redo #count").innerHTML = redoCount;
        },
        cloneCurrentState: () => {
            let copy = JSON.parse(JSON.stringify(this.graphConf));
            return copy;
        },
        updateStateInStack: () => {
            this._graphDefaults.undoStack.push(this._historyManager.cloneCurrentState());
            this._graphDefaults.redoStack = [];
            this._historyManager.updateStackCount();
        }
    }
    _createNode = {
        // functions for creating nodes and nodes variable
        nodeObj: (nodeId, nodeConf, parentConf) => {
            if (!nodeId || this.getNode(nodeId))
                return;
            switch (nodeConf.type) {
                case 'parallel':
                    this._createNode.clusterNodes(nodeId, nodeConf, parentConf);
                    break;
                case 'switch':
                    this._createNode.branches(nodeId, nodeConf, parentConf);
                    break;
                case 'condition':
                    this._createNode.conditions(nodeId, nodeConf, parentConf);
                    break;
                case 'success':
                case 'failure':
                    this._createNode.terminators(nodeId, nodeConf, parentConf);
                    break;
                default:
                    this._createNode.normalNode(nodeId, nodeConf, parentConf);
                    break;
            }
            this.drawNode(nodeConf.id, this.getNode(nodeConf.id).data);
        },
        normalNode: (nodeId, nodeConf, parentConf) => {

            this.nodes[nodeId] = this._fetchData.nodeObject(nodeConf.type, nodeConf, parentConf);

            let nextNode = nodeConf.next;
            let nextNodeConf = parentConf[nextNode];

            let successor = this._fetchData.successorId(nodeId, nodeConf, parentConf);
            this._createNode.nodeObj(nextNode, nextNodeConf, parentConf);

            if (successor) {
                this._updatenodesObject.setValue(nodeId, "successor", successor);
                this._updatenodesObject.pushIfNew(nodeId, "next", successor);
                this._updatenodesObject.pushIfNew(successor, "previous", nodeId);
            }
        },
        clusterNodes: (nodeId, nodeConf, parentConf) => {
            this.nodes[nodeId] = this._fetchData.nodeObject(nodeConf.type, nodeConf, parentConf);

            let startNode = nodeConf.startNode.id;
            this.nodes[startNode] = this._fetchData.nodeObject("parallelStart", nodeConf, parentConf);
            this.drawNode(startNode, this.getNode(startNode).data);

            let endNode = nodeConf.next;
            let endNodeConf = parentConf[endNode];
            this._createNode.nodeObj(endNode, endNodeConf, parentConf);

            let successor = this._fetchData.successorId(endNode, endNodeConf, parentConf);

            this._updatenodesObject.setValue(nodeId, "successor", successor);
            this._updatenodesObject.pushIfNew(nodeId, "children", startNode);
            this._updatenodesObject.pushIfNew(nodeId, "children", endNode);

            this._updatenodesObject.setValue(startNode, "successor", successor);
            this._updatenodesObject.pushIfNew(startNode, "next", endNode);

            this._updatenodesObject.setValue(endNode, "successor", successor);
            this._updatenodesObject.setValue(endNode, "parent", nodeId);
            this._updatenodesObject.setValue(endNode, "parallelEnd", true);

            let pathIndex = 0;
            nodeConf.paths.forEach(path => {
                let pathStartNode;
                let pathEndNode;
                for (const childId in path) {
                    let childObj = path[childId];
                    this._createNode.nodeObj(childId, childObj, path);
                    this._updatenodesObject.pushIfNew(nodeId, "children", childId);
                    if (!this.getNode(childId).parent)
                        this._updatenodesObject.setValue(childId, "parent", nodeId);
                    this._updatenodesObject.setValue(childId, "pathIndex", pathIndex);

                    if (childObj.start) {
                        this._updatenodesObject.setValue(childId, "start", true);
                        this._updatenodesObject.pushIfNew(childId, "previous", startNode);
                        pathStartNode = childId;

                        if (childObj.type === "parallel") {

                            let childStart = childObj.startNode.id;
                            let childEnd = childObj.next;

                            // this._updatenodesObject.setValue(childId, "start", true);
                            this._updatenodesObject.pushIfNew(startNode, "next", childStart);
                            if (path[childEnd].end === true) {
                                this._updatenodesObject.setValue(childStart, "successor", endNode);
                            }
                        } else {
                            this._updatenodesObject.pushIfNew(startNode, "next", childId);
                        }
                    }
                    if (childObj.end) {
                        this._updatenodesObject.setValue(childId, "end", true);
                        this._updatenodesObject.setValue(childId, "successor", endNode);
                        this._updatenodesObject.pushIfNew(childId, "next", endNode);
                        this._updatenodesObject.pushIfNew(endNode, "previous", childId);
                        pathEndNode = childId;
                    }
                }
                if(pathStartNode && pathEndNode){
                    this._updatenodesObject.push(nodeId, "pathsInfo", {
                        startNode: pathStartNode,
                        endNode: pathEndNode
                    });
                }else{
                    console.error(`Path start key missing, pathIndex : ${pathIndex} startNode : ${pathStartNode}, endNode : ${pathEndNode}`);
                }
                pathIndex++;
            });
            this._updatenodesObject.setValue(nodeId, "nodeConf", nodeConf);
        },
        branches: (nodeId, nodeConf, parentConf) => {
            this.nodes[nodeId] = this._fetchData.nodeObject(nodeConf.type, nodeConf, parentConf);

            nodeConf.cases.forEach(caseBranch => {
                this._createNode.nodeObj(caseBranch.next, parentConf[caseBranch.next], parentConf);
                
                let caseNext = this.getNode(caseBranch.next);
                let name = (caseNext.type === 'parallel') ? caseNext.startNode : caseNext.id;
                
                this._updatenodesObject.setValue(name, "case", caseBranch.case);
                this._updatenodesObject.pushIfNew(caseBranch.next, "previous", nodeId);
                this._updatenodesObject.pushIfNew(nodeId, "next", name);
            });

            let endNode = nodeConf.next;
            let endNodeConf = parentConf[endNode];
            this._createNode.nodeObj(endNode, endNodeConf, parentConf);
            this._updatenodesObject.setValue(endNode, "switchEnd", true);
            this._updatenodesObject.setValue(endNode, "switchId", nodeId);

            let successor = this._fetchData.successorId(endNode, endNodeConf, parentConf);

            this._updatenodesObject.setValue(nodeId, "successor", successor);
            this._updatenodesObject.setValue(endNode, "successor", successor);
            this._updatenodesObject.pushIfNew(nodeId, "next", endNode);
            this._updatenodesObject.pushIfNew(endNode, "previous", nodeId);

        },
        conditions: (nodeId, nodeConf, parentConf) => {
            this.nodes[nodeId] = this._fetchData.nodeObject(nodeConf.type, nodeConf, parentConf);

            let trueNextId = nodeConf.result.trueNext;
            let trueNextConf = parentConf[trueNextId];
            let falseNextId = nodeConf.result.falseNext;
            let falseNextConf = parentConf[falseNextId];
            let endNode = nodeConf.next;
            let endNodeConf = parentConf[endNode];

            this._createNode.nodeObj(trueNextId, trueNextConf, parentConf);

            this._createNode.nodeObj(falseNextId, falseNextConf, parentConf);

            this._createNode.nodeObj(endNode, endNodeConf, parentConf);
            this._updatenodesObject.setValue(endNode, "conditionEnd", true);
            this._updatenodesObject.setValue(endNode, "conditionId", nodeId);

            let successor = this._fetchData.successorId(endNode, endNodeConf, parentConf);

            this._updatenodesObject.setValue(nodeId, "successor", successor);
            this._updatenodesObject.setValue(endNode, "successor", successor);

            this._updatenodesObject.pushIfNew(trueNextId, "previous", nodeId);
            this._updatenodesObject.pushIfNew(falseNextId, "previous", nodeId);

            if (this.getNode(trueNextId).type === 'parallel') {
                let trueNext = this.getNode(trueNextId);
                this._updatenodesObject.pushIfNew(nodeId, "next", trueNext.startNode);
                this._updatenodesObject.pushIfNew(endNode, "previous", trueNext.endNode);
            } else {
                this._updatenodesObject.pushIfNew(nodeId, "next", trueNextId);
                this._updatenodesObject.pushIfNew(endNode, "previous", trueNextId);
            }

            if (this.getNode(falseNextId).type === 'parallel') {
                let falseNext = this.getNode(falseNextId);
                this._updatenodesObject.pushIfNew(nodeId, "next", falseNext.startNode);
                this._updatenodesObject.pushIfNew(endNode, "previous", falseNext.endNode);
            } else {
                this._updatenodesObject.pushIfNew(nodeId, "next", falseNextId);
                this._updatenodesObject.pushIfNew(endNode, "previous", falseNextId);
            }


            this._updatenodesObject.setValue(nodeId, "nodeConf", nodeConf);
        },
        terminators: (nodeId, nodeConf, parentConf) => {
            this.nodes[nodeId] = this._fetchData.nodeObject(nodeConf.type, nodeConf, parentConf)
        }
    }
    _futureNextFinder = {
        // methods for finding future nexts of all nodes 
        allSources: () => {
            let sourceNodes = this.graph.sources().filter(source => this._futureNextFinder.isValidSource(source));
            sourceNodes.forEach(source => {
                this._futureNextFinder.inSource(source);
            });
            sourceNodes.forEach(source => {
                let otherSources = sourceNodes.filter(node => (node !== source));
                this._futureNextFinder.addOtherSources(source, otherSources)
            });
        },
        isValidSource: (nodeId) => {
            let nodeObj = this.getNode(nodeId);
            if (nodeObj.type === 'parallel') {
                return false;
            } else {
                let parent = nodeObj.parent;
                if (!parent)
                    return true;
                else if (nodeObj.parallelStart) {
                    return this.getNode(parent).parent ? false : true;
                }
                return false;
            }
        },
        inSource: (sourceNode) => {
            let nodeHierarchy = this._futureNextFinder.getHierarchy(sourceNode, null);
            this._futureNextFinder.setFuturesFromHierarchy(nodeHierarchy);
        },
        getHierarchy: (startNode, endNode) => {
            let hierarchy = [];
            let next = startNode;
            while (next && next !== endNode) {
                let nextObj = this.getNode(next);
                if (next.futureNext) {
                    hierarchy.push(next);
                    hierarchy.push(nextObj.successor);
                    hierarchy.push(...nextObj.futureNext);
                    break;
                } else if (hierarchy.indexOf(next) === -1) {
                    hierarchy.push(next);
                } else {
                    // stop here to break formation of cycles
                    break;
                }
                next = nextObj.successor;
            }
            if (endNode) {
                hierarchy.push(endNode);
            }
            return hierarchy;
        },
        setFuturesFromHierarchy: (hierarchy) => {
            let index = 0;
            hierarchy.forEach(node => {
                this._updatenodesObject.addFutureNext(node, hierarchy.slice(index + 2));
                this._futureNextFinder.analyzeNodeInternals(node);
                index++;
            });
        },
        analyzeNodeInternals: (nodeId) => {
            let nodeObj = this.getNode(nodeId);
            if (!(nodeObj.parallelStart || nodeObj.type === 'switch' || nodeObj.type === 'condition'))
                return
            let hierarchy = nodeObj.futureNext || [];
            if (nodeObj.parallelStart) {
                let endNode = this.getNode(nodeObj.parent).endNode;
                this._updatenodesObject.addFutureNext(endNode, hierarchy);
                this._futureNextFinder.setInnerParallelFutures(nodeObj.parent);
            } else if (nodeObj.type === 'switch') {
                let endNode = nodeObj.end;
                this._updatenodesObject.addFutureNext(endNode, hierarchy);
                this._futureNextFinder.setInnerSwitchFutures(nodeId);
            } else if (nodeObj.type === 'condition') {
                let endNode = nodeObj.end;
                this._updatenodesObject.addFutureNext(endNode, hierarchy);
            }
        },
        setInnerParallelFutures: (parallelId) => {
            let parallelObj = this.getNode(parallelId);
            let parallelEnd = parallelObj.endNode;

            let pathsInfo = parallelObj.pathsInfo || [];
            pathsInfo.forEach(pathInfoObj => {
                let pathStartNode = pathInfoObj.startNode;
                if (this.getNode(pathStartNode).type === 'parallel') {
                    pathStartNode = this.getNode(pathStartNode).startNode;
                }
                let hierarchy = this._futureNextFinder.getHierarchy(pathStartNode, parallelEnd);
                this._futureNextFinder.setFuturesFromHierarchy(hierarchy);
            });
        },
        setInnerSwitchFutures: (switchId) => {
            let switchNodeObj = this.getNode(switchId);
            let switchEnd = switchNodeObj.end;
            switchNodeObj.cases.forEach(caseObj => {
                let caseNext = caseObj.next;
                let hierarchy = this._futureNextFinder.getHierarchy(caseNext, switchEnd);
                this._futureNextFinder.setFuturesFromHierarchy(hierarchy);
                hierarchy.forEach(nodeId => {
                    this._updatenodesObject.setValue(nodeId, "insideSwitch", true);
                    this._updatenodesObject.setValue(nodeId, "switchId", switchId);
                    this._updatenodesObject.setValue(nodeId, "switchExitNode", switchEnd);
                    this._updatenodesObject.addFutureNext(nodeId, [switchNodeObj.successor]);
                    this._updatenodesObject.addFutureNext(nodeId, switchNodeObj.futureNext);
                });
            });
        },
        addOtherSources: (source, otherSources) => {
            let index = 0;
            let sourceNodeObj = this.getNode(source);
            if (!sourceNodeObj.futureNext) {
                sourceNodeObj.futureNext = [];
            }
            let hierarchy = [source];
            if (sourceNodeObj.successor)
                hierarchy.push(sourceNodeObj.successor);
            if (sourceNodeObj.futureNext.length > 0)
                hierarchy.push(...sourceNodeObj.futureNext);
            hierarchy.forEach(node => {
                let validSourceNexts = otherSources.filter(otherSource =>
                    this._futureNextFinder.isNodeToSourceValid(node, otherSource)
                );
                this._updatenodesObject.addFutureNext(node, validSourceNexts);

                let nodeObject = this.getNode(node);
                if (nodeObject.parallelStart) {
                    let parallelEnd = this.getNode(nodeObject.parent).endNode;
                    this._updatenodesObject.addFutureNext(parallelEnd, validSourceNexts);
                } else if (nodeObject.type === 'condition') {
                    let condEnd = nodeObject.end;
                    this._updatenodesObject.addFutureNext(condEnd, validSourceNexts);
                } else if (nodeObject.type === 'switch') {
                    let switEnd = nodeObject.end;
                    this._updatenodesObject.addFutureNext(switEnd, validSourceNexts);
                }
                index++;
            });
        },
        isNodeToSourceValid: (nodeId, sourceId) => {
            return (this.validator.validateEdgeCreation(nodeId, sourceId)
                && !this._futureNextFinder.isDescendant(sourceId, nodeId));
        },
        isDescendant: (node, descendant) => {
            if (!this.getNode(node).futureNext) {
                return false;
            }
            let nodeFutureNexts = this.getNode(node).futureNext;
            let endIndex = nodeFutureNexts.indexOf(this._graphEnd);
            let descendantIndex = nodeFutureNexts.indexOf(descendant);
            if (descendantIndex !== -1) {
                // descendant present in futureNext
                if (descendantIndex > endIndex) {
                    // if descendant node is after the end node in futureNext, 
                    // which means It is prediction and its not actually connected
                    return false;
                }
                return true;
            } else {
                return false;
            }

        },

    }
    _bindListeners = {
        zoomEvt: (svg, zoom, parentDiv) => {

            const zoomStep = 1.2;

            // Restore previous zoom position if available
            if (this._graphDefaults.currentZoomTransform) {
                svg.call(zoom.transform, this._graphDefaults.currentZoomTransform);
            } else {
                document.querySelector(`#${this.graphOutletDiv} .actions #reCenter`).click();
            }

            d3.select(`#${this.graphOutletDiv} .actions #zoomIn`).on("click", () => {
                svg.transition().duration(300).call(zoom.scaleBy, zoomStep);
            });

            d3.select(`#${this.graphOutletDiv} .actions #zoomOut`).on("click", () => {
                svg.transition().duration(300).call(zoom.scaleBy, 1 / zoomStep);
            });

            parentDiv.querySelector("#reCenter").addEventListener("click", () => {
                const initialScale = 0.75;
                const graphWidth = this.graph.graph().width;
                const graphHeight = this.graph.graph().height;
                const svgWidth = +svg.attr("width");
                const svgHeight = +svg.attr("height");
                const horizontalTranslate = (svgWidth - graphWidth * initialScale) / 2;
                const verticalTranslate = ((svgHeight - graphHeight * initialScale) / 2) > 0 ? (svgHeight - graphHeight * initialScale) / 2 : 20;
                this._graphDefaults.currentZoomTransform = d3.zoomIdentity
                    .translate(horizontalTranslate,verticalTranslate)
                    .scale(initialScale);
                svg.transition().duration(300).call(zoom.transform, this._graphDefaults.currentZoomTransform);
            });

            window.addEventListener("resize", () => {
                this._bindListeners.resizeSVG(svg);
                svg.call(zoom.transform, this._graphDefaults.currentZoomTransform); // Reapply zoom
            });
        },
        resizeSVG: (svg) => {
            const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

            const width = 0.65 * vw;
            const height = 1 * vh;

            svg.attr("width", width).attr("height", height);
        },
        actionBtnEvents: (parentDiv) => {
            const resetBtn = parentDiv.querySelector("#reset");
            resetBtn.removeEventListener("click", this._historyManager.handleResetClick);
            resetBtn.addEventListener("click", this._historyManager.handleResetClick);

            const undoBtn = parentDiv.querySelector("#undo");
            undoBtn.removeEventListener("click", this._historyManager.handleUndoClick);
            undoBtn.addEventListener("click", this._historyManager.handleUndoClick);

            const redoBtn = parentDiv.querySelector("#redo");
            redoBtn.removeEventListener("click", this._historyManager.handleRedoClick);
            redoBtn.addEventListener("click", this._historyManager.handleRedoClick);
        },
        nodeEvents: () => {
            let nodes = document.querySelectorAll(".nodes .node");
            nodes.forEach(node => {
                node.dataset.nodeId = node.querySelector('.label tspan').innerHTML;
                node.addEventListener("click", () => {
                    this.setActiveNode(node.dataset.nodeId);
                });
            });
        },
        edgeEvents: () => {
            let addIcons = document.querySelectorAll("#addNodeIcon");
            // let compIns = this.componentIns;
            addIcons.forEach(icon => {
                icon.addEventListener("click", () => {
                    let from = icon.dataset.from;
                    let to = icon.dataset.to;
                    let id = this._fetchData.newNodeId("node");
                    this.update.add(id, "node", from, to);
                })
            });
        },
        edgeDropEvents: () => {
            let self = this;
            document.querySelectorAll(`#${this.graphOutletDiv} #addNodeIcon`).forEach(droppableElem => {
                droppableElem.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    droppableElem.parentElement.classList.add("hover");
                    let fromNode = droppableElem.dataset.from;
                    let toNode = droppableElem.dataset.to;
                    let type = window[self.dragTypeVarName];
                    let isDroppable = self.validator.validateEdgeCreation(fromNode, toNode, type);
                    if (isDroppable) {
                        droppableElem.parentElement.classList.add("dropHover");
                    } else {
                        droppableElem.parentElement.classList.add("noDropHover");
                    }
                });

                droppableElem.addEventListener('dragleave', function (e) {
                    droppableElem.parentElement.classList.remove("hover");
                    droppableElem.parentElement.classList.remove("dropHover");
                    droppableElem.parentElement.classList.remove("noDropHover");
                });

                droppableElem.addEventListener('drop', function (e) {
                    e.preventDefault();
                    let fromNode = droppableElem.dataset.from;
                    let toNode = droppableElem.dataset.to;
                    let type = window[self.dragTypeVarName];
                    let isDroppable = self.validator.validateEdgeCreation(fromNode, toNode, type);
                    let nodeId = self._fetchData.newNodeId(type);
                    if (isDroppable) {
                        droppableElem.parentElement.classList.remove("noDropHover");
                        droppableElem.parentElement.classList.remove("dropHover");
                        self.update.add(nodeId, type, fromNode, toNode);
                        // self._graphDefaults.draggables[type].newCount++;
                    } else {
                        droppableElem.parentElement.classList.remove("noDropHover");
                    }

                });
            });

        },
    }
    _appendEdgeExtras = {
        fromToInfo: () => {
            d3.selectAll(`#${this.graphOutletDiv} .edgePath`).each(function (d) {
                d3.select(this)
                    .select("path")
                    .attr("data-from", d.v)
                    .attr("data-to", d.w);
            });
        },
        foreignObjs: () => {
            let self = this;
            d3.selectAll(`#${this.graphOutletDiv} path.path`).each(function (d, i) {
                const path = d3.select(this);
                const domPath = this;

                // Get total length of the path
                const totalLength = domPath.getTotalLength();

                // Get midpoint position
                const midpoint = domPath.getPointAtLength(totalLength / 2);

                d3.select(this.parentNode)
                    .append("foreignObject")
                    .attr("x", midpoint.x - 50)
                    .attr("y", midpoint.y - 25)
                    .attr("width", 135)
                    .attr("height", 50)
                    .attr("class", "embedded-form")
                    .append("xhtml:div")
                    .html(`
                    <div 
                    class="noDrop"
                    style="
                    font-family: sans-serif;
                    font-size: 13px;
                    padding: 10px;
                    background: #ffe1e1;
                    gap: 0.25vw;
                    align-items: center;
                    border: 1px dashed #c95e5e;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    color: #6e6e6e;">
                        <div>
                            <strong>
                                X Couldn't drop   
                            </strong>
                        </div>    
                        
                    </div>
                `);

                d3.select(this.parentNode)
                    .append("foreignObject")
                    .attr("x", midpoint.x - 50)
                    .attr("y", midpoint.y - 25)
                    .attr("width", 120)
                    .attr("height", 50)
                    .attr("class", "embedded-form")
                    .append("xhtml:div")
                    .html(`
                    <div 
                    class="dropHere"
                    style="
                    font-family: sans-serif;
                    font-size: 13px;
                    padding: 10px;
                    background: #f2f2f2;
                    gap: 0.25vw;
                    align-items: center;
                    border: 1px dashed #a6a6a6;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    color: #6e6e6e;
                    ">
                        <div>
                            <strong>
                              + Drop Here   
                            </strong>
                        </div>    
                        
                    </div>
                `);

                d3.select(this.parentNode)
                    .append("foreignObject")
                    .attr("x", midpoint.x - 10)
                    .attr("y", midpoint.y - 10)
                    .attr("width", 20)
                    .attr("height", 20)
                    .attr("id", "addNodeIcon")
                    .attr("lt-prop-title", "Add new node")
                    .attr("data-from", path.attr("data-from"))
                    .attr("data-to", path.attr("data-to"))
                    .append("xhtml:div")
                    .html(`
                            <span class="material-symbols-outlined"
                            style="font-size:15px;font-weight:bold;">
                                +
                            </span>                       
                    `)
                    .style("width", "20px")
                    .style("height", "20px")
                    .style("display", "flex")
                    .style("align-items", "center")
                    .style("justify-content", "center")
                    .style("background", "#f5f5f594")
                    .style("border", "1px solid #f5f5f5")
                    .style("color", "#424242")
                    .style("border-radius", "50%")
                    .style("cursor", "pointer")
                    .style("font-size", "14px")

            });
            d3.selectAll('.node').each(function () {
                const group = d3.select(this);
                const nodeId = this.__data__;
                const bbox = this.getBBox();

                // Avoid start/end nodes
                if (nodeId === self._graphStart || nodeId === self._graphEnd) return;

                // Add menu only if not already present
                if (!this.querySelector('.three-dot-icon')) {
                    group.append('foreignObject')
                    .attr('x', bbox.x + bbox.width - 15)
                    .attr('y', bbox.y - 7.5)
                    .attr('width', 20)
                    .attr('height', 25)
                    .attr('class', 'three-dot-icon')
                    .style('cursor', 'pointer')
                    .html(`<div style="
                        font-size: 18px;
                        font-weight: bold;
                        text-align: center;
                        user-select: none;
                        color: #666;
                        padding: 2px;
                        ">⋮</div>`)
                    .on('click', function () {
                        // Remove existing menus
                        if(this.parentElement.querySelector('.action-menu'))
                            d3.selectAll('.action-menu').remove();
                        else {
                            d3.selectAll('.action-menu').remove();
                            group.append('foreignObject')
                            .attr('x', bbox.x + bbox.width - 80)
                            .attr('y', bbox.y + 10)
                            .attr('width', 80)
                            .attr('height', 60)
                            .attr('class', 'action-menu')
                            .html(`
                                <div style="
                                    background: white;
                                    border: 1px solid #ccc;
                                    border-radius: 4px;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                                    font-family: system-ui, sans-serif;
                                    font-size: 13px;
                                    color: #333;
                                    overflow: hidden;
                                ">
                                    <div class="action-option" style="
                                    padding: 6px 10px;
                                    cursor: pointer;
                                    border-bottom: 1px solid #eee;
                                    transition: background 0.2s;
                                    ">Rename</div>
                                    <div class="action-option" style="
                                    padding: 6px 10px;
                                    cursor: pointer;
                                    color: #e53935;
                                    transition: background 0.2s;
                                    ">Delete</div>
                                </div>
                                `)

                            const menu = group.select('.action-menu');
                            const options = menu.selectAll('.action-option').nodes();
                            menu.selectAll('.action-option')
                                .on('mouseenter', function () {
                                    d3.select(this).style('background', '#f5f5f5');
                                })
                                .on('mouseleave', function () {
                                    d3.select(this).style('background', 'none');
                                });
                            // --- Rename action ---
                            options[0].addEventListener('click', function () {
                                menu.remove();
                                group.select('.three-dot-icon').style('display','none');

                                // Create rename input
                                group.append('foreignObject')
                                    .attr('x', bbox.x + 5)
                                    .attr('y', bbox.y + (bbox.height / 4))
                                    .attr('width', bbox.width * 0.9)
                                    .attr('height', bbox.height + 10)
                                    .attr('class', 'editable-input')
                                    .html(`<input type="text" value="${nodeId}" 
                                            style="width:${bbox.width * 0.85}px; 
                                            padding:2px; 
                                            border:none;
                                            border-bottom:1px solid #e6e6e6;
                                            outline:none;" />`);

                                const inputEl = group.select('.editable-input input').node();
                                inputEl.focus();
                                inputEl.select();

                                inputEl.addEventListener('keydown', function (e) {
                                    if (e.key === 'Enter') inputEl.blur();
                                });

                                inputEl.addEventListener('blur', function () {
                                    let value = inputEl.value.trim();
                                    if (value && value !== nodeId) {
                                        self.update.rename(nodeId, value);
                                    }
                                    group.select('.editable-input').remove();
                                    group.select('.three-dot-icon').style('display','block');
                                }, { once: true });
                            });

                            // --- Delete action ---
                            options[1].addEventListener('click', function () {
                                menu.remove();
                                group.select('.three-dot-icon').remove();
                                self.update.delete(nodeId);
                            });
                        }
                        d3.event.stopImmediatePropagation();
                    });
                    
                }
            });
        },


    }
    EventBus = (function () {
        let listeners = {};
        let idCounter = 0;

        return {
            addEventListener(eventName, callback) {
                const id = ++idCounter;
                if (!listeners[eventName]) listeners[eventName] = [];
                listeners[eventName].push({ id, callback });
                return id;
            },

            removeEventListener(id) {
                for (let eventName in listeners) {
                    listeners[eventName] = listeners[eventName].filter(l => l.id !== id);
                }
            },

            triggerEvent(eventName, data) {
                if (!listeners[eventName]) return;
                listeners[eventName].forEach(({ callback }) => callback(data));
            }
        };
    })();
    appendGraphActionsHTML() {
        const actionsHTML = `
                <div class="actions">
                    <div class="iconWrapper" id="reset"
                        title="Clear path : Clears all intermediate steps, keeping only Start and End nodes.">
                        <span class="material-symbols-outlined">rebase</span>
                    </div>
                    <div class="iconWrapper" id="undo" title="Undo">
                        <span class="material-symbols-outlined">undo</span>
                        <span id="count">0</span>
                    </div>
                    <div class="iconWrapper" id="redo" title="Redo">
                        <span class="material-symbols-outlined">redo</span>
                        <span id="count">0</span>
                    </div>
                    <div class="iconWrapper" id="zoomIn" title="Zoom in">
                        <span class="material-symbols-outlined">zoom_in</span>
                    </div>
                    <div class="iconWrapper" id="zoomOut" title="Zoom out">
                        <span class="material-symbols-outlined">zoom_out</span>
                    </div>
                    <div class="iconWrapper" id="reCenter" title="Re-center">
                        <span class="material-symbols-outlined">recenter</span>
                    </div>
                </div>`;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = actionsHTML;
        const actionsElement = tempDiv.firstElementChild;

        const graphContainer = document.getElementById(`${this.graphOutletDiv}`);
        graphContainer.classList.add('QGraph_root');
        graphContainer.appendChild(actionsElement);

    }
    appendGraphDraggablesHTML() {
        const draggablesHTML = `
                <div id="draggables_panel">
                    <div class="item" draggable="true" id='condition' tabindex="0">
                        Condition
                    </div>
                    <div class="item" draggable="true" id='switch' tabindex="0">
                        Switch
                    </div>
                    <div class="item" draggable="true" id='actions' tabindex="0">
                        Actions
                    </div>
                    <div class="item" draggable="true" id='parallel' tabindex="0">
                        Parallel
                    </div>
                    <div class="item" draggable="true" id='node' tabindex="0">
                        Node
                    </div>
                    <div class="item" draggable="true" id='success' tabindex="0">
                        Success
                    </div>
                    <div class="item" draggable="true" id='failure' tabindex="0">
                        Failure
                    </div>
                </div>`;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = draggablesHTML;
        const containerElement = tempDiv.firstElementChild;

        const graphContainer = document.getElementById(`${this.graphOutletDiv}`);
        graphContainer.classList.add('QGraph_root');
        graphContainer.insertBefore(containerElement, graphContainer.firstChild);

        for (const draggable in this._graphDefaults.draggables) {
            let draggableId = this._graphDefaults.draggables[draggable].id;
            let draggableElem = document.querySelector(`#${this.graphOutletDiv} #draggables_panel ${draggableId}`);
            draggableElem.addEventListener('dragstart', function (e) {
                let elem = e.target.cloneNode(true);
                elem.style.width = "fit-content";
                elem.style.border = "1px solid #e6e6e6";
                elem.style.borderRadius = "5px";
                elem.style.padding = "0.5vw"
                elem.style.backgroundColor = "#fff";
                elem.style.position = "absolute";
                document.body.appendChild(elem);
                const { width, height } = elem.getBoundingClientRect();
                e.dataTransfer.setDragImage(elem, width / 2, height / 2);
                e.dataTransfer.setData('text', draggable);
                window.currentDraggingElement = draggable;
                // document.currentDraggingElement = draggable;
            });
        }

    }
    renderGraph() {
        this.init();
        if (this._graphDefaults.isInitialLoad) {
            this.appendGraphDraggablesHTML();
            this.appendGraphActionsHTML();
        }
        this.renderToDOM();
        if (this._graphDefaults.isInitialLoad) {
            this._historyManager.updateStateInStack();
            this._graphDefaults.isInitialLoad = false;
            document.querySelector(`#${this.graphOutletDiv} .actions #reCenter`).click();
        }
        this._bindListeners.nodeEvents();
        if (this.activeNode && Object.keys(this.activeNode).length > 0) {
            this.setActiveNode(this.activeNode.id);
        } else {
            this.setActiveNode(this._graphStart);
        }
        this._bindListeners.edgeEvents();
        this._bindListeners.edgeDropEvents();
        this.EventBus.triggerEvent("graphConfChange", this.graphConf);

    }
    init() {
        if (!window.graphs) {
            window.graphs = {};
        }
        window.graphs[this.graphId] = this;
        this.graph = new dagreD3.graphlib.Graph({
            compound: true,
            multigraph: true
        }).setGraph({}).setDefaultEdgeLabel({});
        this.nodes = {};

        this.initNodeCreation();
        this.initEdgeCreation();
        this._futureNextFinder.allSources();
    }
    initNodeCreation() {
        for (const nodeId in this.graphConf) {
            if (!this.getNode(nodeId)) {
                this._createNode.nodeObj(nodeId, this.graphConf[nodeId], this.graphConf);
            }
        }
        this._updatenodesObject.setPredecessors();
    }
    initEdgeCreation() {
        for (const nodeId in this.nodes) {
            let nodeObj = this.getNode(nodeId);
            if (this.graph.nodes().indexOf(nodeId) === -1) {
                console.error(`Node ${nodeId} doesn"t exists`)
            } else {
                if (nodeObj.children.length > 0) {
                    nodeObj.children.forEach(child => {
                        this.setParent(child, nodeId);
                    });
                }
                nodeObj.next.forEach(next => {
                    if (this.validator.validateEdgeCreation(nodeId, next)) {
                        if (this.getNode(next).type === 'parallel') {
                            console.error(`An edge is being created from "${nodeId}" to "${next}", which is a cluster node. Replace "${next}" with the ID of its start node to avoid an error when setting the graph's rank.`);
                        } else if (nodeObj.parallelStart && this.getNode(next).parallelEnd) {
                            this.drawEdge(nodeId, next, {
                                arrowhead: "normal",
                                label: "Add Path"
                            });
                        } else if (nodeObj.type === 'condition') {
                            if (next === nodeObj.result.trueNext) {
                                this.drawEdge(nodeId, next, { arrowhead: "normal", label: "True" });
                            } else if (next === nodeObj.result.falseNext) {
                                this.drawEdge(nodeId, next, { arrowhead: "normal", label: "False" });
                            } else {
                                this.drawEdge(nodeId, next, { arrowhead: "normal" });
                            }
                        } else if (nodeObj.type === 'switch') {
                            if (next === nodeObj.end) {
                                this.drawEdge(nodeId, next, { arrowhead: "normal", label: "Add Case" });
                            } else {
                                this.drawEdge(nodeId, next, { arrowhead: "normal", label: `${this.getNode(next).case}` });
                            }
                        } else
                            this.drawEdge(nodeId, next, { arrowhead: "normal" });
                    } else {
                        console.error(`validation for edge creation failed ! from node : ${nodeId} to node : ${next} `)
                    }
                });
            }
        }
    }
    drawNode(id, data) {
        data = JSON.parse(JSON.stringify(data));
        this.graph.setNode(id, data);        
    }
    drawEdge(from, to, data) {
        data = JSON.parse(JSON.stringify(data));
        if (this.graph.nodes().indexOf(from) !== -1 && this.graph.nodes().indexOf(to) !== -1)
            this.graph.setEdge(from, to, data);
        else {
            if (this.graph.nodes().indexOf(from) === -1) {
                console.error(`node ${from} (from) not exists `);
            }
            if (this.graph.nodes().indexOf(to) === -1) {
                console.error(`node from node ${from} exists but to node ${to} not exists `);
            }
        }
    }
    setParent(child, parent) {
        this.graph.setParent(child, parent);
    }
    renderToDOM() {
        var svg = d3.select(`#${this.graphOutletDiv} svg`);
        svg.selectAll("*").remove();
        var inner = svg.append("g");
        const zoom = d3.zoom().scaleExtent([0.25, 10]).on("zoom", () => {
            const transform = d3.event.transform;
            inner.attr("transform", transform);
            this._graphDefaults.currentZoomTransform = transform;
        });

        svg.call(zoom);

        var render = new dagreD3.render();

        render(inner, this.graph);

        this._appendEdgeExtras.fromToInfo();
        this._appendEdgeExtras.foreignObjs();

        let actionsDiv = document.querySelector(`#${this.graphOutletDiv} .actions`);

        this._bindListeners.resizeSVG(svg);
        this._bindListeners.zoomEvt(svg, zoom, actionsDiv);
        
        this._bindListeners.actionBtnEvents(actionsDiv);
    }
    getNode(nodeId) {
        return this.nodes[nodeId];
    }
    setActiveNode(id) {
        if (document.querySelector(".node.focused"))
            document.querySelector(".node.focused").classList.remove("focused");
        if (this.getNode(id) && this.getNode(id).type === 'parallel') {
            id = this.getNode(id).startNode;
        }
        let node = document.querySelector(`.node[data-node-id="${id}"]`);
        if (!node) {
            node = document.querySelector(`.node[data-node-id="${this._graphDefaults.start}"]`);
            id=this._graphDefaults.start;
            if(!node){
                console.error('Missing start node!');
            }
        }
        node.classList.add("focused");
        this.activeNode = this.getNode(id);
        this.EventBus.triggerEvent("activeNodeChange", this.activeNode);
    }
}