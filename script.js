class User {
	constructor(data) {
		this.data = data
		this.focusedNode = this.data.nodes[0]
	}

	setFocusedNode(node) {
		this.focusedNode = node
		try {
			this.focusedNode.element.textArea.focus()
		}
		catch(e) {
		}
	}
	

	createChildNode() {
		let childNode = this.data.addNode(window.getSelection().toString(), -1)
		childNode.setParent(this.focusedNode)
		this.focusedNode.registerChild(childNode)
		return childNode
	}

	createAndFocus() {
		let childNode = this.createChildNode()
		this.setFocusedNode(childNode)
	}
}

class Node {
	constructor(value, id) {
		console.log(id)
		this.value = value
		this.id = id
		this.parent = null
		this.children = []
		this.setElement(0)
	}

	setValue(value) {
		this.value = value
	}

	setElement(element) {
		this.element = element
	}
	
	setParent(node) {
		this.parent = node
	}

	registerChild(node) {
		this.children.push(node)
	}

	unregisterChild(node) {
		this.children = this.children.filter(n => n.id != node.id)
	}
}

class HotkeyManager {
	constructor(renderer) {
		this.renderer = renderer
	}

	manage(e) {
		if (e.key == 'k' && e.ctrlKey) {
			e.preventDefault()
			this.renderer.user.createAndFocus()
			this.renderer.render()
			return
		}
		if (e.key == ';' && e.ctrlKey) {
			e.preventDefault()
			if(this.renderer.user.focusedNode.id === 0) return
			this.renderer.user.data.deleteNode(this.renderer.user.focusedNode)
			this.renderer.render()
			return
		}
		if(e.key == '1' && e.ctrlKey) {
			e.preventDefault()
			let parent = this.renderer.user.focusedNode.parent
			if (parent !== null)
				this.renderer.user.setFocusedNode(this.renderer.user.focusedNode.parent)
			return
		}
		if(e.ctrlKey && isFinite(parseInt(e.key))){
			e.preventDefault()
			let travelingNodeIndex = parseInt(e.key) - 2
			let travelingNode = this.renderer.user.focusedNode.children[travelingNodeIndex] || undefined
			if (travelingNode !== undefined)
				this.renderer.user.setFocusedNode(travelingNode)
				this.renderer.user.focusedNode.element.textArea.focus()
			return
		}

	}
}

class Data {
	constructor(nodes, idmanager, renderer) {
		if(nodes.length == 0) {
			this.nodes = [new Node('', idmanager.giveNodeId())]
		} else {
			this.nodes = nodes
		}
		this.idmanager = idmanager
	}

	setRenderer(renderer) {
		this.renderer = renderer
	}

	setNodes(nodes) {
		this.nodes = nodes
		this.renderer.render()
	}

	addNode(value, id) {
		let newNode = new Node(value, id != -1 ? id : idmanager.giveNodeId())
		this.setNodes(this.nodes.concat(newNode))
		return newNode
	}

	deleteNode(node) {
		node.children.forEach(n =>  {
			n.setParent(node.parent)
			node.parent.registerChild(n)
		})
		node.parent.unregisterChild(node)
		this.renderer.user.setFocusedNode(node.parent)
		this.setNodes(this.nodes.filter(n => n != node))
	}

	getNodeById(nodeId) {
		return this.nodes.filter(n => n.id == nodeId)[0]
	}

	stringify() {
		return JSON.stringify(this.nodes.map(node => {
			return {id: node.id,
				children: node.children.map(c => c.id),
				parent: node.parent == null ? -1 : node.parent.id,
				value: node.value
			}
		}))
	}

	fromString(jsonString) {
		this.nodes = []
		let nodeArray = JSON.parse(jsonString)
		nodeArray.forEach(flatNode => {
			this.addNode(flatNode.value, flatNode.id)
		})
		nodeArray.forEach(flatNode => {
			let node = this.getNodeById(flatNode.id)
			node.setParent(this.getNodeById(flatNode.parent) || 0)
			flatNode.children.forEach(childId => {
				node.registerChild(this.getNodeById(childId))
			})
		})
		this.idmanager.nodeId = Math.max(...nodeArray.map(n => n.id))
		this.renderer.render()
	}
}

class Renderer {
	constructor(user, container, d3) {
		this.user = user
		this.container = container
		this.d3 = d3
	}

	render() {
		this.container.innerHTML = ''
		let tree = this.calculateTree()
		this.d3.select('svg g')
			.selectAll('line')
			.data(tree.links())
			.join('line')
			.attr('x1', function(d) {return d.source.x;})
			.attr('y1', function(d) {return d.source.y;})
			.attr('x2', function(d) {return d.target.x;})
			.attr('y2', function(d) {return d.target.y;});


		this.d3.select('svg g')
			.selectAll('text.label')
			.data(tree.descendants())
			.join('foreignObject')
			.attr('x', function(d) {return d.x;})
			.attr('y', function(d) {return d.y;})
			.attr('id', function(d) {
				return 'node' + d.data.id
			})
			.attr('width', '200px')
			.attr('height', '100px')


		this.user.data.nodes.forEach(n => {
			if(n.parent === null && n.id !== 0) return
			let textArea = document.createElement('textarea')
			textArea.innerHTML = n.value
			textArea.onchange = e => {
				n.setValue(textArea.value)
			}
			textArea.onfocus = e => {
				this.user.focusedNode = n
			}
			textArea.oninput = e => {
				textArea.style.height = '1px'
				textArea.style.height = textArea.scrollHeight + 'px'
			}
			let element = document.getElementById('node' + n.id)
			n.setElement(element)
			n.element.appendChild(textArea)
			n.element.textArea = textArea
		})
		this.user.focusedNode.element.textArea.focus()
		this.user.focusedNode.element.textArea.scrollIntoView({
			behavior: 'auto',
			block: 'center',
			inline: 'center'
		})
	}

	calculateTree() {
		let descendants = this.d3.tree()(this.d3.hierarchy(this.user.data.nodes[0])).descendants()
		let maxDepth = Math.max(...descendants.map(d => d.depth))
		let maxAbscissa = Math.max(...descendants.map(d => d.x))

		let width = (maxAbscissa + 2) * 400
		let height = maxDepth * 100 + 100

		this.container.parentNode.setAttribute('height', height + 100 + 'px')
		this.container.parentNode.setAttribute('width',  width + 500 + 'px')
		
		return this.d3.tree().size([width + 400, height])(this.d3.hierarchy(this.user.data.nodes[0]))
	}

	createNodeElement(node, x, y) {
		let element = document.createElement('div')
		element.id = node.id
		element.style.position = 'absolute'
		element.style.left = x + 'px'
		element.style.top = y + 'px'
		element.textArea = document.createElement('textarea')
		element.textArea.innerHTML = node.value
		element.appendChild(element.textArea)
		element.textArea.onchange = e => {
			node.setValue(element.textArea.value)
		}
		element.textArea.onfocus = e => {
			this.user.focusedNode = node
		}
		this.container.appendChild(element)
		node.setElement(element)
	}
}

class IdManager {
	constructor() {
		this.nodeId = 0
	}

	giveNodeId() {
		return this.nodeId++
	}
}

let container = document.querySelector('svg g')

let idmanager = new IdManager()


let data = new Data([], idmanager)
let user = new User(data)
let renderer = new Renderer(user, container, d3)
let hotkeymanager = new HotkeyManager(renderer)

data.setRenderer(renderer)
document.onkeydown = e => hotkeymanager.manage(e)

container.style['minimum-width'] = '100vh'

renderer.render()

