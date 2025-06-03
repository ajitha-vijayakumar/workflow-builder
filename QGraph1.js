class QGraph1 {
    constructor(confData) {
        this.graphConf = confData.graphData;
        this.graphId = confData.graphId;
        this.graphConfData = {
            compound: confData.isCompound,
            multigraph: true
        };
        this.graph = null;
        this.componentIns = confData.componentIns;
        this.nodes = {};
        this.edges = {};
        this.newNodeCount = 0;
        this.activeNode = {};
    }

    validator = {

        validateEdgeCreation: (toNodeType, fromId, toId) => {
            if (toNodeType === "success" || toNodeType === "failure") {
                if (fromId === "Start" || (this.validator.isParallelChild(fromId) && this.validator.isParallelChild(toId))) {
                    return false;
                } else {
                    return true;
                }
            } else {
                return true;
            }
        },
        isParallelChild: (nodeId) => {
            let parent = this.nodes[nodeId].parent;
            return (parent && this.nodes[parent].type === "parallel") ? true : false;
        }

    }
    fetchData = {

        parentNode: (nodeData) => {
            let searchNode = nodeData.parent;
            if (nodeData.parallelEnd)
                searchNode = this.nodes[nodeData.parent].parent;
            if (searchNode)
                return this.fetchData.nodeObject(nodeData.parent);
            return this.graphConf;
        },
        nodeObject: (nodeId) => {
            if (this.graphConf[nodeId]) {
                return this.graphConf[nodeId];
            } else {
                let data = null;
                for (const key in this.graphConf) {
                    if (this.graphConf[key].type === "parallel") {
                        data = this.fetchData.searchInParallel(this.graphConf[key], nodeId);
                        if (data) {
                            return data;
                        }
                    }
                }
                return data;
            }

        },
        searchInParallel: (parallelObj, nodeId) => {
            let data = null;
            if (parallelObj.startNode.data.label === nodeId) {
                return parallelObj.startNode;
            } else {
                for (const pathIndex in parallelObj.paths) {
                    let path = parallelObj.paths[pathIndex];
                    if (path[nodeId]) {
                        return path[nodeId];
                    } else {
                        for (const id in path) {
                            if (path[id].type === "parallel") {
                                data = this.fetchData.searchInParallel(path[id], nodeId);
                                if (data.length > 0) {
                                    return data;
                                }
                            }
                        }
                    }
                }
            }
            return data;
        },
        newNode: (type, id, to) => {
            if (type === "node") {
                return {
                    [id]: {
                        type: type,
                        next: to,
                        data: { shape: "ellipse", label: id }
                    }
                };
            } else if (type === "parallel") {
                return {
                    [id]: {
                        type: "parallel",
                        data: { label: id, clusterLabelPos: "top", style: "fill: #d3d7e878" },
                        startNode: {
                            type: "node",
                            data: { shape: "ellipse", label: id + " start" }
                        },
                        paths: [],
                        next: id + " end"
                    },
                    [id + " end"]: {
                        type: "node",
                        next: to,
                        data: { shape: "ellipse", label: id + " end" }
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
                        data: { shape: "diamond", label: id }
                    },
                    [id + " TPath"]: {
                        type: "node",
                        next: id + " end",
                        data: { shape: "ellipse", label: id + " TPath" }
                    },
                    [id + " FPath"]: {
                        type: "node",
                        next: id + " end",
                        data: { shape: "ellipse", label: id + " FPath" }
                    },
                    [id + " end"]: {
                        type: "node",
                        next: to,
                        data: { shape: "ellipse", label: id + " end" }
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
                        data: { shape: "ellipse", label: id }
                    },
                    [id + " Default"]: {
                        type: "node",
                        next: id + " end",
                        data: { shape: "ellipse", label: id + " Default" }
                    },
                    [id + " end"]: {
                        type: "node",
                        next: to,
                        data: { shape: "ellipse", label: id + " end" }
                    }
                }
            } else if (type === "success" || type === "failure") {
                let color = (type === "success") ? "#00da0082" : "#ff0000a6"
                return {
                    [id]: {
                        type: type,
                        next: null,
                        data: { shape: "circle", label: id, style: `fill:${color}` }
                    }
                }
            }
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
            let data = this.nodes[id];
            let next = ''
            if (data.parallelStart || data.parallelEnd || data.parent) {
                let parentNext = this.nodes[data.parent].nodeConf.next;
                next = this.nodes[parentNext].nodeConf.next;
            } else if (data.type === "switch" || data.type === "condition" || data.type === "parallel")
                next = this.nodes[data.nodeConf.next].nodeConf.next;
            else {
                next = data.nodeConf.next;
            }
            if (next && this.nodes[next].type === 'parallel') {
                next = this.nodes[next].startNode;
            }
            return next;
        }
    }
    update = {
        add: (id, type, from, to) => {
            let fromNodeData = this.nodes[from];
            let toNodeData = this.nodes[to];
            if (toNodeData.parallelStart) {
                to = toNodeData.parent;
            }
            let newNodes = this.fetchData.newNode(type, id, to);
            let fromNodeObj = this.nodes[from].nodeConf;
            if (fromNodeData.parent) {
                let parent = this.nodes[fromNodeData.parent].nodeConf;
                if (fromNodeData.parallelStart) {
                    if (toNodeData.parallelEnd) {
                        this.update.addNewPath(parent.paths, newNodes);
                    } else {
                        let path = this.fetchData.findParentPath(to, parent);
                        this.update.prependToPath(newNodes, path);
                    }
                } else if (fromNodeData.parallelEnd && !this.nodes[fromNodeData.parent].parent) {
                    // from node is a end of parallel and it is not inside any parallel
                    let parent = this.fetchData.parentNode(this.nodes[fromNodeData.parent]);
                    for (const nodeId in newNodes) {
                        Lyte.objectUtils(parent, "add", nodeId, newNodes[nodeId]);
                    }
                    Lyte.objectUtils(fromNodeObj, "delete", "next");
                    Lyte.objectUtils(fromNodeObj, "add", "next", id);
                } else {
                    if (fromNodeData.parallelEnd) {
                        from = fromNodeData.parent;
                        parent = this.fetchData.parentNode(this.nodes[fromNodeData.parent]);
                    }
                    if (toNodeData.parallelEnd) {
                        for (const nodeId in newNodes) {
                            if (newNodes[nodeId].next === to) {
                                newNodes[nodeId].next = null;
                                newNodes[nodeId].end = true;
                            }
                        }
                        Lyte.objectUtils(fromNodeObj, "delete", "end");
                    }

                    let pathToAdd = this.fetchData.findParentPath(from, parent);
                    for (const nodeId in newNodes) {
                        Lyte.objectUtils(pathToAdd, "add", nodeId, newNodes[nodeId]);
                    }
                    if (fromNodeData.type === "condition") {
                        this.update.updateParentCondition(id, fromNodeObj, to);
                    } else if (fromNodeData.type === "switch") {
                        this.update.updateParentSwitch(id, fromNodeObj, to);
                    } else {
                        Lyte.objectUtils(fromNodeObj, "delete", "next");
                        Lyte.objectUtils(fromNodeObj, "add", "next", id);
                    }
                }
            } else {
                for (const nodeId in newNodes) {
                    Lyte.objectUtils(this.graphConf, "add", nodeId, newNodes[nodeId]);
                }
                if (fromNodeData.type === "node") {
                    Lyte.objectUtils(fromNodeObj, "delete", "next");
                    Lyte.objectUtils(fromNodeObj, "add", "next", id);
                } else if (fromNodeData.type === "condition") {
                    this.update.updateParentCondition(id, fromNodeObj, to);
                } else if (fromNodeData.type === "switch") {
                    this.update.updateParentSwitch(id, fromNodeObj, to);
                }

            }
            this.renderGraph();
        },
        next: (id, previousTo, to) => {
            this.update.deepNextUpdate(id, previousTo, to);
            this.renderGraph();
        },
        deepNextUpdate: (from, previousTo, to) => {
            if (!this.validator.validateEdgeCreation(this.nodes[to].type, from, to))
                return

            let fromData = this.nodes[from];
            let toData = this.nodes[to];
            let toCopy = to;
            if (toData.parallelStart) {
                toCopy = toData.parent;
            }
            if (fromData.parallelStart) {
                let parallelEnd = this.nodes[this.nodes[fromData.parent].endNode];
                parallelEnd.nodeConf.next = toCopy;
            }else if(fromData.type === 'parallel'){
                let parallelEnd = this.nodes[fromData.endNode];
                parallelEnd.nodeConf.next = toCopy;
            } else if (fromData.type === 'condition' || fromData.type === 'switch') {
                let branchEnd = this.nodes[fromData.nodeConf.next];
                branchEnd.nodeConf.next = toCopy;
            } else {
                fromData.nodeConf.next = toCopy;
            }

            if (fromData.insideSwitch && !toData.insideSwitch) {
                if (previousTo)
                    this.update.deepNextUpdate(to, '', previousTo);

                let toIndex = fromData.futureNext.indexOf(to);
                if (toIndex !== -1) {
                    let toSuccessor = toData.successor;
                    let toPredecessor = (toIndex === 0) ? fromData.switchExitNode : fromData.futureNext[toIndex - 1];
                    this.update.deepNextUpdate(toPredecessor, '', toSuccessor);
                }
            }
        },
        addNewPath(paths, newNodes) {
            newNodes[Object.keys(newNodes)[0]].start = true;
            if (Object.keys(newNodes).length > 1) {
                let lastNode = newNodes[Object.keys(newNodes)[Object.keys(newNodes).length - 1]];
                lastNode.end = true;
                lastNode.next = null;
            } else {
                newNodes[Object.keys(newNodes)[0]].end = true;
                newNodes[Object.keys(newNodes)[0]].next = null;
            }
            Lyte.arrayUtils(paths, "push", newNodes);
        },
        prependToPath(newNodes, pathToAdd) {
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
                Lyte.objectUtils(pathToAdd[firstNodeId], "delete", "start");
                newNodes[Object.keys(newNodes)[0]].start = true;
                if (newNodes[Object.keys(newNodes)[0]].type === "success" || newNodes[Object.keys(newNodes)[0]].type === "failure") {
                    newNodes[Object.keys(newNodes)[0]].end = true;
                    Lyte.objectUtils(pathToAdd[lastNodeId], "delete", "end");
                }
                for (const nodeId in newNodes) {
                    Lyte.objectUtils(pathToAdd, "add", nodeId, newNodes[nodeId]);
                }
            }
        },
        updateParentCondition(id, fromNodeObj, toNodeId) {
            if (fromNodeObj.result.trueNext === toNodeId) {
                Lyte.objectUtils(fromNodeObj.result, "delete", "trueNext");
                Lyte.objectUtils(fromNodeObj.result, "add", "trueNext", id);
            } else if (fromNodeObj.result.falseNext === toNodeId) {
                Lyte.objectUtils(fromNodeObj.result, "delete", "falseNext");
                Lyte.objectUtils(fromNodeObj.result, "add", "falseNext", id);
            }
        },
        updateParentSwitch(id, fromNodeObj, toNodeId) {
            let cases = fromNodeObj.cases;
            let isInside = (toNodeId !== fromNodeObj.next);
            if (isInside) {
                for (const caseIndex in cases) {
                    if (cases[caseIndex].next === toNodeId) {
                        Lyte.objectUtils(cases[caseIndex], "delete", "next");
                        Lyte.objectUtils(cases[caseIndex], "add", "next", id);
                        isInside = true;
                        break;
                    }
                }
            } else {
                Lyte.arrayUtils(cases, "push", {
                    case: "",
                    next: id
                });
            }
        }
    }

    renderGraph() {
        this.init();
        this.renderToDOM();
        this.addNodeEvtListeners();
        this.addEdgeEvtListeners();
        this.makeEdgesDroppable();
        this.activeNode = this.nodes["Start"];
        // this.componentIns.throwEvent("on-graph-update", this.graphConf, this.graphId);
    }
    init() {

        if (!window.graphs) {
            window.graphs = {};
        }

        window.graphs[this.graphId] = this;
        this.graph = new dagreD3.graphlib.Graph(this.graphConfData).setGraph({}).setDefaultEdgeLabel({});
        this.nodes = {};

        this.initNodeCreation();
        this.findFutureNexts();
        this.initEdgeCreation();
    }
    initNodeCreation() {
        for (const nodeId in this.graphConf) {
            if (!this.nodes[nodeId]) {
                this.createNodeObj(nodeId, this.graphConf[nodeId], this.graphConf);
            }
        }
    }

    createNodeObj(nodeId, nodeConf, parentConf) {
        if (nodeConf.data)
            this.drawNode(nodeConf.data.label, nodeConf.data);
        switch (nodeConf.type) {
            case 'parallel':
                this.createClusterNodes(nodeId, nodeConf, parentConf);
                break;
            case 'switch':
                this.createBranches(nodeId, nodeConf, parentConf);
                break;
            case 'condition':
                this.createConditions(nodeId, nodeConf, parentConf);
                break;
            case 'success':
            case 'failure':
                this.createTerminators(nodeId, nodeConf, parentConf);
                break;
            default:
                this.createNormalNode(nodeId, nodeConf, parentConf);
                break;
        }

    }
    createNormalNode(nodeId, nodeConf, parentConf) {
        if (!this.nodes[nodeId])
            this.nodes[nodeId] = {
                type: nodeConf.type,
                data: nodeConf.data,
                parent: (parentConf.data) ? parentConf.data.label : null,
                children: [],
                previous: [],
                next: [],
                nodeConf: nodeConf
            }
        if (nodeConf.next && (!this.nodes[nodeConf.next]) && parentConf[nodeConf.next]) {
            this.createNodeObj(nodeConf.next, parentConf[nodeConf.next], parentConf);
        }
        let next = (nodeConf.next && parentConf[nodeConf.next] && parentConf[nodeConf.next].type === "parallel") ? parentConf[nodeConf.next].startNode.data.label : nodeConf.next;
        if (nodeConf.next) {
            this.nodes[nodeConf.data.label].successor = next;
        }
        if (this.nodes[next]) {
            if (this.nodes[nodeId].next.indexOf(next) === -1)
                this.nodes[nodeId].next.push(next);
            if (this.nodes[next].previous.indexOf(nodeId) === -1)
                this.nodes[next].previous.push(nodeId);
        }
    }
    createClusterNodes(nodeId, nodeConf, parentConf) {
        this.nodes[nodeId] = {
            type: nodeConf.type,
            data: nodeConf.data,
            parent: (parentConf.data) ? parentConf.data.label : null,
            children: [],
            startNode: nodeConf.startNode.data.label,
            endNode: nodeConf.next,
            previous: [],
            next: [],
            nodeConf: nodeConf
        }
        this.nodes[nodeConf.startNode.data.label] = {
            type: "node",
            data: nodeConf.startNode.data,
            nodeConf: nodeConf.startNode,
            parallelStart: true,
            parent: nodeId,
            children: [],
            previous: [],
            next: [nodeConf.next]
        }
        this.drawNode(nodeConf.startNode.data.label, nodeConf.startNode.data);

        if (nodeConf.next && !this.nodes[nodeConf.next]) {
            this.createNodeObj(nodeConf.next, parentConf[nodeConf.next], parentConf);
        }
        this.nodes[nodeConf.next].parent = nodeId;
        if (parentConf[nodeConf.next].next) {
            this.nodes[nodeConf.next].successor = parentConf[nodeConf.next].next;
        }
        this.nodes[nodeId].successor = this.nodes[nodeConf.next].successor;
        this.nodes[nodeConf.startNode.data.label].successor = this.nodes[nodeConf.next].successor;
        this.nodes[nodeConf.next].parallelEnd = true;
        this.nodes[nodeId].children.push(nodeConf.startNode.data.label);
        this.nodes[nodeId].children.push(nodeConf.next);

        let pathIndex = 0;
        nodeConf.paths.forEach(path => {
            for (const childId in path) {
                if (!this.nodes[childId]) {
                    this.createNodeObj(childId, path[childId], path);
                }
                if (!this.nodes[childId].parent) {
                    this.nodes[childId].parent = nodeId;
                }
                this.nodes[childId].pathIndex = pathIndex;
                this.nodes[nodeId].children.push(childId);

                if (path[childId].start) {
                    this.nodes[childId].previous.push(nodeConf.startNode.data.label);
                    this.nodes[childId].start = true;
                    if (path[childId].type === "parallel") {
                        this.nodes[nodeConf.startNode.data.label].next.push(path[childId].startNode.data.label);
                        if (path[path[childId].next].end) {
                            this.nodes[path[childId].startNode.data.label].successor = nodeConf.next;
                        }
                    } else {
                        this.nodes[nodeConf.startNode.data.label].next.push(childId);
                    }
                }
                if (path[childId].end) {
                    this.nodes[childId].end = true;
                    this.nodes[childId].next.push(nodeConf.next);
                    this.nodes[childId].successor = nodeConf.next;
                    this.nodes[nodeConf.next].previous.push(childId);
                }
            }
            pathIndex++;
        });
        this.nodes[nodeId].nodeConf = nodeConf;
    }
    createBranches(nodeId, nodeConf, parentConf) {
        if (!this.nodes[nodeId])
            this.nodes[nodeId] = {
                type: nodeConf.type,
                data: nodeConf.data,
                nodeConf: nodeConf,
                parent: (parentConf.data) ? parentConf.data.label : null,
                cases: nodeConf.cases,
                children: [],
                previous: [],
                next: [],
                end: nodeConf.next
            }
        nodeConf.cases.forEach(caseBranch => {
            this.createNodeObj(caseBranch.next, parentConf[caseBranch.next], parentConf);
            if (this.nodes[caseBranch.next] && this.nodes[caseBranch.next].previous.indexOf(nodeId) === -1) {
                this.nodes[caseBranch.next].previous.push(nodeId);
                this.nodes[nodeId].next.push(caseBranch.next);
            }
        });

        if (!this.nodes[nodeConf.next]) {
            this.createNodeObj(nodeConf.next, parentConf[nodeConf.next], parentConf);
        }
        this.nodes[nodeId].successor = parentConf[nodeConf.next].next;
        this.nodes[nodeConf.next].successor = parentConf[nodeConf.next].next;
        if (this.nodes[nodeId].next.indexOf(nodeConf.next) === -1)
            this.nodes[nodeId].next.push(nodeConf.next);
        if (this.nodes[nodeConf.next].previous.indexOf(nodeId) === -1)
            this.nodes[nodeConf.next].previous.push(nodeId);
    }
    createConditions(nodeId, nodeConf, parentConf) {
        if (!this.nodes[nodeId])
            this.nodes[nodeId] = {
                type: nodeConf.type,
                data: nodeConf.data,
                nodeConf: nodeConf,
                parent: (parentConf.data) ? parentConf.data.label : null,
                result: nodeConf.result,
                children: [],
                previous: [],
                next: [],
                end: nodeConf.next
            }
        if (!this.nodes[nodeConf.result.trueNext]) {
            this.createNodeObj(nodeConf.result.trueNext, parentConf[nodeConf.result.trueNext], parentConf);
        }
        if (!this.nodes[nodeConf.result.falseNext]) {
            this.createNodeObj(nodeConf.result.falseNext, parentConf[nodeConf.result.falseNext], parentConf);
        }
        if (!this.nodes[nodeConf.next]) {
            this.createNodeObj(nodeConf.next, parentConf[nodeConf.next], parentConf);
        }

        this.nodes[nodeId].successor = parentConf[nodeConf.next].next;
        this.nodes[nodeConf.next].successor = parentConf[nodeConf.next].next;

        if (this.nodes[nodeConf.result.trueNext]) {
            this.nodes[nodeConf.result.trueNext].previous.push(nodeId);
            this.nodes[nodeId].next.push(nodeConf.result.trueNext);
            this.nodes[nodeConf.next].previous.push(nodeConf.result.trueNext);
        }
        if (this.nodes[nodeConf.result.falseNext]) {
            this.nodes[nodeConf.result.falseNext].previous.push(nodeId);
            this.nodes[nodeId].next.push(nodeConf.result.falseNext);
            this.nodes[nodeConf.next].previous.push(nodeConf.result.falseNext);
        }
        this.nodes[nodeId].nodeConf = nodeConf;
    }
    createTerminators(nodeId, nodeConf, parentConf) {
        this.nodes[nodeId] = {
            type: nodeConf.type,
            data: nodeConf.data,
            nodeConf: nodeConf,
            parent: (parentConf.data) ? parentConf.data.label : null,
            children: [],
            previous: [],
            next: []
        }
    }
    findFutureNexts() {
        let nodeHierarchy = [];
        let next = "Start";
        while (next) {
            if (nodeHierarchy.indexOf(next) === -1) {
                nodeHierarchy.push(next);
            }
            next = this.fetchData.next(next);
        }
        for (let index = 0; index < nodeHierarchy.length; index++) {
            const nextArray = nodeHierarchy.slice(index + 2);
            let node = this.nodes[nodeHierarchy[index]];
            node.futureNext = nextArray;
            if (node.parallelStart) {
                let end = this.nodes[this.nodes[node.parent].endNode];
                end.futureNext = nextArray;
                this.processInnerParallelNodes(this.nodes[node.parent]);
            } else if (node.type === 'switch' || node.type === 'condition') {
                this.nodes[node.end].futureNext = nextArray;
                if (node.type === 'switch') {
                    this.processInnerSwitchNodes(node);
                }
            }
        }
    }
    processInnerSwitchNodes(switchNode) {
        let end = switchNode.end;
        switchNode.cases.forEach(caseObj => {
            let next = caseObj.next;
            let nodeHierarchy = [];
            while (next && next !== end) {
                if (nodeHierarchy.indexOf(next) === -1) {
                    nodeHierarchy.push(next);
                }
                let node = this.nodes[next];
                node.insideSwitch = true;
                node.parentSwitch = switchNode.data.label;
                node.switchExitNode = switchNode.end;
                next = node.successor;
            }
            nodeHierarchy.push(end);
            if (switchNode.successor)
                nodeHierarchy.push(switchNode.successor);
            if (switchNode.futureNext)
                nodeHierarchy.push(...switchNode.futureNext);
            for (let index = 0; index < nodeHierarchy.length; index++) {
                const nextArray = nodeHierarchy.slice(index + 2);
                let node = this.nodes[nodeHierarchy[index]];
                node.futureNext = nextArray;
                if (node.parallelStart) {
                    let end = this.nodes[this.nodes[node.parent].endNode];
                    end.futureNext = nextArray;
                    this.processInnerParallelNodes(this.nodes[node.parent]);
                } else if (node.type === 'switch' || node.type === 'condition') {
                    this.nodes[node.end].futureNext = nextArray;
                    if (node.type === 'switch') {
                        this.processInnerSwitchNodes(node);
                    }
                } else if (node.type === 'parallel') {
                    this.processInnerParallelNodes(node);
                }
            }
        });
    }

    processInnerParallelNodes(parallelNode) {
        parallelNode.nodeConf.paths.forEach(path => {
            let start = '';
            let end = '';
            for (const nodeId in path) {
                if (path[nodeId].start) {
                    start = nodeId;
                }
                if (path[nodeId].end) {
                    end = nodeId;
                }
            }
            let nodeHierarchy = [];
            let next = start;
            while (next && next !== end) {
                if (nodeHierarchy.indexOf(next) === -1) {
                    nodeHierarchy.push(next);
                }
                next = this.nodes[next].successor;
            }
            if (this.nodes[end].parent === parallelNode.data.label)
                nodeHierarchy.push(end);
            nodeHierarchy.push(parallelNode.nodeConf.next);
            for (let index = 0; index < nodeHierarchy.length; index++) {
                const nextArray = nodeHierarchy.slice(index + 2);
                let node = this.nodes[nodeHierarchy[index]];
                node.futureNext = nextArray;
                if (node.parallelStart) {
                    let end = this.nodes[this.nodes[node.parent].endNode];
                    end.futureNext = nextArray;
                    this.processInnerParallelNodes(this.nodes[node.parent]);
                } else if (node.type === 'switch' || node.type === 'condition') {
                    this.nodes[node.end].futureNext = nextArray;
                    if (node.type === 'switch') {
                        this.processInnerSwitchNodes(node);
                    }
                } else if (node.type === 'parallel') {
                    this.processInnerParallelNodes(node);
                }
            }
        });
    }
    initEdgeCreation() {
        for (const nodeId in this.nodes) {
            let nodeObj = this.nodes[nodeId];
            if (this.graph.nodes().indexOf(nodeId) === -1) {
                console.errori(`Node ${nodeId} doesn"t exists`)
            } else {
                if (nodeObj.children.length > 0) {
                    nodeObj.children.forEach(child => {
                        this.setParent(child, nodeId);
                    });
                }
                nodeObj.next.forEach(next => {
                    if (this.validator.validateEdgeCreation(this.nodes[next].type, nodeId, next)) {
                        if (this.nodes[nodeId].parallelStart && this.nodes[next].parallelEnd) {
                            this.drawEdge(nodeId, next, {
                                arrowhead: "normal",
                                label: "Add Path"
                            });

                        } else
                            this.drawEdge(nodeId, next, { arrowhead: "normal" });

                        // this.renderToDOM();
                    } else {
                        console.error(`validation for edge creation failed ! from node : ${nodeId} to node : ${next} `)
                    }
                });
            }
        }

    }
    drawNode(id, data) {
        this.graph.setNode(id, data);
        // this.nodeList.push(id);
        // console.log("create node : ", id, data);
    }
    drawEdge(from, to, data) {
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
        // this.renderToDOM();
    }
    setParent(child, parent) {
        this.graph.setParent(child, parent);
        // console.log("create parent : ", child, parent);
    }
    renderToDOM() {

        var svg = d3.select(`#${this.graphId} svg`);
        svg.selectAll("*").remove();

        var inner = svg.append("g");

        var zoom = d3.zoom().scaleExtent([0.25, 10]).on("zoom", function () {
            inner.attr("transform", d3.event.transform);
        });
        svg.call(zoom);

        var render = new dagreD3.render();

        render(inner, this.graph);
        d3.selectAll(".edgePath").each(function (d) {
            d3.select(this)
                .select("path")
                .attr("data-from", d.v)
                .attr("data-to", d.w);
        });

        d3.selectAll("path.path").each(function (d, i) {
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
                        <span class="material-symbols-outlined">
                                cancel
                        </span>
                    </div>
                    <div>
                        <strong>
                            Couldn"t drop   
                        </strong>
                    </div>    
                    
                </div>
            `);

            d3.select(this.parentNode)
                .append("foreignObject")
                .attr("x", midpoint.x - 50)
                .attr("y", midpoint.y - 50)
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
                        <span class="material-symbols-outlined">
                                add_circle
                        </span>
                    </div>
                    <div>
                        <strong>
                            Drop Here   
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
                        style="font-size:16px;font-weight:bold;">
                            add
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

        this.resizeSVG(svg);
        this.addZoomEvtListeners(svg, zoom);

    }
    resizeSVG(svg) {
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

        const width = 0.65 * vw;
        const height = 0.9125 * vh;

        svg.attr("width", width).attr("height", height);
    }

    addZoomEvtListeners(svg, zoom) {
        var initialScale = 0.75;
        svg.call(zoom.transform, d3.zoomIdentity.translate((svg.attr("width") - this.graph.graph().width * initialScale) / 2, 20).scale(initialScale));

        let actions = document.querySelector(".graphContainer_root .zoomHandlers");
        const zoomStep = 1.2; // scale factor per click (20% in/out)

        d3.select(".graphContainer_root .zoomHandlers #zoomIn").on("click", () => {
            svg.transition().duration(300).call(zoom.scaleBy, zoomStep);
        });

        d3.select(".graphContainer_root .zoomHandlers #zoomOut").on("click", () => {
            svg.transition().duration(300).call(zoom.scaleBy, 1 / zoomStep);
        });
        actions.querySelector("#reCenter").addEventListener("click", () => {
            initialScale = 0.75;
            svg.call(zoom.transform, d3.zoomIdentity.translate((svg.attr("width") - this.graph.graph().width * initialScale) / 2, 20).scale(initialScale));
        });
        window.addEventListener("resize", () => {
            this.resizeSVG(svg);
            svg.call(
                zoom.transform,
                d3.zoomIdentity
                    .translate((svg.attr("width") - this.graph.graph().width * initialScale) / 2, 20)
                    .scale(initialScale)
            );
        });

    }
    addNodeEvtListeners() {
        let nodes = document.querySelectorAll(".nodes .node");
        // let compIns = this.getComponentInstance();
        nodes.forEach(node => {
            node.addEventListener("click", () => {
                if (document.querySelector(".node.focused"))
                    document.querySelector(".node.focused").classList.remove("focused");
                node.classList.add("focused");
                let focusedItem = node.querySelector("text tspan").innerHTML;
                this.activeNode = this.nodes[focusedItem];
                Lyte.triggerEvent("activeNodeChange" + this.graphId, this.graphId, this.activeNode, this.nodes);
            });
        });
    }

    addEdgeEvtListeners() {
        let addIcons = document.querySelectorAll("#addNodeIcon");
        // let compIns = this.componentIns;
        addIcons.forEach(icon => {
            icon.addEventListener("click", () => {
                let from = icon.dataset.from;
                let to = icon.dataset.to;
                let id = "New Node " + this.newNodeCount;
                this.update.add(id, "node", from, to);
                this.newNodeCount++;
            })
        });
    }
    makeEdgesDroppable() {
        let self = this;
        $L(`#${self.graphId} #addNodeIcon`).droppable({
            hoverClass: "hover",
            tolerance: "touch",
            onEnter: function (draggableElem, droppableElem) {
                droppableElem.parentElement.classList.add("hover");
                let fromNode = droppableElem.dataset.from;
                let toNode = droppableElem.dataset.to;
                let type = draggableElem.dataset.type;

                let isDroppable = self.validator.validateEdgeCreation(type, fromNode, toNode);

                if (isDroppable) {
                    droppableElem.parentElement.classList.add("dropHover");
                } else {
                    droppableElem.parentElement.classList.add("noDropHover");
                }

            },
            onLeave: function (draggableElem, droppableElem) {
                droppableElem.parentElement.classList.remove("hover");
                droppableElem.parentElement.classList.remove("dropHover");
                droppableElem.parentElement.classList.remove("noDropHover");
            },
            onDrop: function (draggedElem, droppableElem) {
                let fromNode = droppableElem.dataset.from;
                let toNode = droppableElem.dataset.to;
                let nodeId = draggedElem.id;

                let type = draggedElem.dataset.type;

                let isDroppable = self.validator.validateEdgeCreation(type, fromNode, toNode);
                if (isDroppable) {
                    droppableElem.parentElement.classList.remove("noDropHover");
                    droppableElem.parentElement.classList.remove("dropHover");
                    self.update.add(nodeId, type, fromNode, toNode);
                    // compIns.setData(`draggables.${type}.newCount`, compIns.data.draggables[type].newCount + 1);
                } else {
                    droppableElem.parentElement.classList.remove("noDropHover");
                }
            }
        })
    }
}