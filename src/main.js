import Chart from 'chart.js';

var defaultOptions = {
	select: {
		enabled: true,
		direction: 'xy',
		selectboxBackgroundColor: 'rgba(66,133,244,0.2)',
		selectboxBorderColor: '#48F',
	},
	callbacks: {
		beforeSelect: function (startX, endX, startY, endY) {
			return true;
		},
		afterSelect: function (startX, endX, startY, endY, datasets) {
		}
	}
}

function getOption(chart, category, name) {
	return Chart.helpers.getValueOrDefault(chart.options.plugins.boxselect[category] ? chart.options.plugins.boxselect[category][name] : undefined, defaultOptions[category][name]);
}


function getXScale(chart) {
	return chart.data.datasets.length ? chart.scales[chart.getDatasetMeta(0).xAxisID] : null;
}
function getYScale(chart) {
	return chart.scales[chart.getDatasetMeta(0).yAxisID];
}


function doSelect(chart, startX, endX, startY, endY) {
	// swap start/end if user dragged from right to left
	if (startX > endX) {
		var tmp = startX;
		startX = endX;
		endX = tmp;
	}
	if (startY > endY) {
		var tmp = startY;
		startY = endY;
		endY = tmp;
	}

	// notify delegate
	var beforeSelectCallback = Chart.helpers.getValueOrDefault(chart.options.plugins.boxselect.callbacks ? chart.options.plugins.boxselect.callbacks.beforeSelect : undefined, defaultOptions.callbacks.beforeSelect);

	if (!beforeSelectCallback(startX, endX, startY, endY)) {
		return false;
	}

	var datasets = [];
	// filter dataset
	for (var datasetIndex = 0; datasetIndex < chart.data.datasets.length; datasetIndex++) {
		const sourceDataset = chart.data.datasets[datasetIndex];

		var selectedDataset = {
			data: [],
			indexes: []
		};
		// if the dataset has labels, get them too
		if (sourceDataset.labels) {
			selectedDataset.labels = [];
		}

		// iterate data points
		for (var dataIndex = 0; dataIndex < sourceDataset.data.length; dataIndex++) {

			var dataPoint = sourceDataset.data[dataIndex];

			let filterOnX = true;
			let inX = true;
			if (startX == null) {
				filterOnX = false;
			} else {
				inX = (dataPoint.x >= startX && dataPoint.x <= endX)
			}
			let filterOnY = true;
			let inY = true;
			if (startY == null) {
				filterOnY = false;
			} else {
				inY = (dataPoint.y >= startY && dataPoint.y <= endY)
			}

			if (inX && inY) {
				selectedDataset.data.push({ ...dataPoint });
				selectedDataset.indexes.push(dataIndex)
				if (selectedDataset.labels) {
					selectedDataset.labels.push(sourceDataset.labels[dataIndex]);
				}
			}
		}
		datasets.push(selectedDataset);
	}

	chart.boxselect.start = startX;
	chart.boxselect.end = endX;

	// chart.update();

	var afterSelectCallback = getOption(chart, 'callbacks', 'afterSelect');
	afterSelectCallback(startX, endX, startY, endY, datasets);
}

function drawSelectbox(chart) {

	var borderColor = getOption(chart, 'select', 'selectboxBorderColor');
	var fillColor = getOption(chart, 'select', 'selectboxBackgroundColor');
	var direction = getOption(chart, 'select', 'direction');

	chart.ctx.beginPath();
	// if direction == xy, rectangle
	// if direction == x, horizontal selection only
	// if direction == y, vertical selection only
	let xStart = chart.boxselect.dragStartX;
	let yStart = chart.boxselect.dragStartY;
	let xSize = chart.boxselect.x - chart.boxselect.dragStartX;
	let ySize = chart.boxselect.y - chart.boxselect.dragStartY;
	if (direction == 'x') {
		var yScale = getYScale(chart);
		yStart = yScale.getPixelForValue(yScale.max);
		ySize = yScale.getPixelForValue(yScale.min) - yScale.getPixelForValue(yScale.max);
	} else if (direction == 'y') {
		var xScale = getXScale(chart);
		xStart = xScale.getPixelForValue(xScale.max);
		xSize = xScale.getPixelForValue(xScale.min) - xScale.getPixelForValue(xScale.max);
	}
	// x y width height
	chart.ctx.rect(xStart, yStart, xSize, ySize);
	chart.ctx.lineWidth = 1;
	chart.ctx.strokeStyle = borderColor;
	chart.ctx.fillStyle = fillColor;
	chart.ctx.fill();
	chart.ctx.fillStyle = '';
	chart.ctx.stroke();
	chart.ctx.closePath();
}

var boxselectPlugin = {

	id: 'boxselect',

	afterInit: function (chart) {

		if (chart.config.options.scales.xAxes.length == 0) {
			return
		}

		if (chart.options.plugins.boxselect === undefined) {
			chart.options.plugins.boxselect = defaultOptions;
		}

		chart.boxselect = {
			enabled: false,
			x: null,
			y: null,
			dragStarted: false,
			dragStartX: null,
			dragEndX: null,
			dragStartY: null,
			dragEndY: null,
			suppressTooltips: false,
		};

	},

	afterEvent: function (chart, e) {

		var chartType = chart.config.type;
		if (chartType !== 'scatter' && chartType !== 'line') return;

		// fix for Safari
		var buttons = (e.native.buttons === undefined ? e.native.which : e.native.buttons);
		if (e.native.type === 'mouseup') {
			buttons = 0;
		}

		chart.boxselect.enabled = true;

		// handle drag to select
		var selectEnabled = getOption(chart, 'select', 'enabled');

		if (buttons === 1 && !chart.boxselect.dragStarted && selectEnabled) {
			chart.boxselect.dragStartX = e.x;
			chart.boxselect.dragStartY = e.y;
			chart.boxselect.dragStarted = true;
		}

		// handle drag to select
		if (chart.boxselect.dragStarted && buttons === 0) {
			chart.boxselect.dragStarted = false;

			var direction = getOption(chart, 'select', 'direction');
			// if direction == xy, rectangle
			// if direction == x, horizontal selection only
			// if direction == y, vertical selection only

			var xScale = getXScale(chart);
			var yScale = getYScale(chart);
			var startX = xScale.getValueForPixel(chart.boxselect.dragStartX);
			var endX = xScale.getValueForPixel(chart.boxselect.x);
			var startY = yScale.getValueForPixel(chart.boxselect.dragStartY);
			var endY = yScale.getValueForPixel(chart.boxselect.y);
			if (direction == 'x') {
				startY = null;
				endY = null;
			} else if (direction == 'y') {
				startX = null;
				endX = null;
			}

			if (Math.abs(chart.boxselect.dragStartX - chart.boxselect.x) > 1 && Math.abs(chart.boxselect.dragStartY - chart.boxselect.y) > 1) {
				doSelect(chart, startX, endX, startY, endY);
			}
		}

		chart.boxselect.x = e.x;
		chart.boxselect.y = e.y;

		chart.draw();
	},

	afterDraw: function (chart) {

		if (!chart.boxselect.enabled) {
			return;
		}

		if (chart.boxselect.dragStarted) {
			drawSelectbox(chart);
		}

		return true;
	},

	beforeTooltipDraw: function (chart) {
		// suppress tooltips on dragging
		return !chart.boxselect.dragStarted && !chart.boxselect.suppressTooltips;
	},

};

Chart.plugins.register(boxselectPlugin);
export default boxselectPlugin;