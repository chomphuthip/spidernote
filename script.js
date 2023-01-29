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
			let parent = this.renderer.user.focusedNode.parent || null
			if (parent !== null)
				this.renderer.user.setFocusedNode(this.renderer.user.focusedNode.parent)
			return
		}
		if(e.key == 's' && e.ctrlKey) {
			e.preventDefault()
			this.renderer.user.data.save()
			return
		}
		if(e.key == 'd' && e.ctrlKey) {
			e.preventDefault()
			this.renderer.user.data.load()
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
		return JSON.stringify(
			{data: this.nodes.map(node => {
				return {id: node.id,
					children: node.children.map(c => c.id),
					parent: node.parent == null ? -1 : node.parent.id,
					value: node.value
				}})
			}
		, null, 2)
	}

	fromString(jsonString) {
		this.nodes = []
		let nodeArray = JSON.parse(jsonString)['data']
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
		this.renderer.user.setFocusedNode(this.nodes[0])
		this.idmanager.nodeId = Math.max(...nodeArray.map(n => n.id))
		this.renderer.render()
	}

	save() {
		let downloadLink = document.createElement('a')
		let file = new Blob([this.stringify()], {type:'application/json'})
		downloadLink.href = URL.createObjectURL(file)
		downloadLink.download = 'notes.json'
		downloadLink.click()
	}

	load() {
		let uploadInput = document.createElement('input')
		uploadInput.type = 'file'

		uploadInput.onchange = e => {
			let file = e.target.files[0]

			let reader = new FileReader()

			reader.readAsText(file)
			reader.onload = e => {
				this.fromString(e.target.result)
			}
		}
		uploadInput.click()
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
		this.resizeUsingTree(tree)
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

			textArea.style.height = '1px'
			textArea.style.height = textArea.scrollHeight + 'px'
		})
		this.user.focusedNode.element.textArea.focus()
		this.user.focusedNode.element.textArea.scrollIntoView({
			behavior: 'auto',
			block: 'center',
			inline: 'center'
		})
	}

	calculateTree() {
		return this.d3.tree().nodeSize([200, 200])(this.d3.hierarchy(this.user.data.nodes[0]))
	}

	resizeUsingTree(tree) {
		let descendants = tree.descendants()

		let maxDepth = Math.max(...descendants.map(d => d.depth))
		let height = maxDepth * 200 + 100
		this.container.parentNode.setAttribute('height', height + 'px')

		let maxAbscissa = Math.max(...descendants.map(d => d.x))
		let minAbscissa = Math.min(...descendants.map(d => d.x))
		let width = (maxAbscissa - minAbscissa + 200)*2

		let svgWidth = width > container.parentNode.parentNode.clientWidth ? width : container.parentNode.parentNode.clientWidth
		this.container.parentNode.setAttribute('width',  svgWidth + 'px')
		this.container.setAttribute('transform', 'translate(' + svgWidth/2 + ',0)')
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
window.onresize = e => renderer.render()

renderer.render()

