import Chart from 'chart.js/auto';
import {valueOrDefault} from 'chart.js/helpers';

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
	if(category in chart.config.options.plugins.boxselect && name in chart.config.options.plugins.boxselect[category]){
		return chart.config.options.plugins.boxselect[category][name];
	}
	return defaultOptions[category][name];
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
		const tmp = startX;
		startX = endX;
		endX = tmp;
	}
	if (startY > endY) {
		const tmp = startY;
		startY = endY;
		endY = tmp;
	}

	// notify delegate
	var beforeSelectCallback = valueOrDefault(chart.options.plugins.boxselect.callbacks ? chart.options.plugins.boxselect.callbacks.beforeSelect : undefined, defaultOptions.callbacks.beforeSelect);
	
	if (!beforeSelectCallback) {
		return false;
	}

	var datasets = [];
	// filter dataset
	for (let datasetIndex = 0; datasetIndex < chart.data.datasets.length; datasetIndex++) {
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
		for (let dataIndex = 0; dataIndex < sourceDataset.data.length; dataIndex++) {

			const dataPoint = sourceDataset.data[dataIndex];

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
	const afterSelectCallback = getOption(chart, 'callbacks', 'afterSelect');
	afterSelectCallback(startX, endX, startY, endY, datasets);
}

function drawSelectbox(chart) {

	const borderColor = getOption(chart, 'select', 'selectboxBorderColor');
	const fillColor = getOption(chart, 'select', 'selectboxBackgroundColor');
	const direction = getOption(chart, 'select', 'direction');

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

const boxselectPlugin = {

	id: 'boxselect',

	afterInit: function (chart) {

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
			suppressTooltips: false
		};

	},

	afterEvent: function (chart, e) {

		const chartType = chart.config.type;
		if (chartType !== 'scatter' && chartType !== 'line') return;
		
		const buttons = e.event.native.buttons;
		chart.boxselect.enabled = true;

		// handle drag to select
		const selectEnabled = getOption(chart, 'select', 'enabled');

		if (buttons === 1 && !chart.boxselect.dragStarted && selectEnabled) {
			chart.boxselect.dragStartX = e.event.x;
			chart.boxselect.dragStartY = e.event.y;
			chart.boxselect.dragStarted = true;
		}

		// handle drag to select
		if (chart.boxselect.dragStarted && buttons === 0) {
			chart.boxselect.dragStarted = false;

			const direction = getOption(chart, 'select', 'direction');
			// if direction == xy, rectangle
			// if direction == x, horizontal selection only
			// if direction == y, vertical selection only

			const xScale = getXScale(chart);
			const yScale = getYScale(chart);
			let startX = xScale.getValueForPixel(chart.boxselect.dragStartX);
			let endX = xScale.getValueForPixel(chart.boxselect.x);
			let startY = yScale.getValueForPixel(chart.boxselect.dragStartY);
			let endY = yScale.getValueForPixel(chart.boxselect.y);
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

		chart.boxselect.x = e.event.x;
		chart.boxselect.y = e.event.y;

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
