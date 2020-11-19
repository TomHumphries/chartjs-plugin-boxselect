(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('chart.js')) :
	typeof define === 'function' && define.amd ? define(['chart.js'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.boxselectplugin = factory(global.Chart));
}(this, (function (Chart) { 'use strict';

	function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

	var Chart__default = /*#__PURE__*/_interopDefaultLegacy(Chart);

	var defaultOptions = {
		select: {
			enabled: true,
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
	};

	function getOption(chart, category, name) {
		return Chart__default['default'].helpers.getValueOrDefault(chart.options.plugins.boxselect[category] ? chart.options.plugins.boxselect[category][name] : undefined, defaultOptions[category][name]);
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
		var beforeSelectCallback = Chart__default['default'].helpers.getValueOrDefault(chart.options.plugins.boxselect.callbacks ? chart.options.plugins.boxselect.callbacks.beforeSelect : undefined, defaultOptions.callbacks.beforeSelect);

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

				if (dataPoint.x >= startX && dataPoint.x <= endX
					&& dataPoint.y >= startY && dataPoint.y <= endY) {
					selectedDataset.data.push({ ...dataPoint });
					selectedDataset.indexes.push(dataIndex);
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

		chart.ctx.beginPath();
		// x y width height
		chart.ctx.rect(chart.boxselect.dragStartX, chart.boxselect.dragStartY, chart.boxselect.x - chart.boxselect.dragStartX, chart.boxselect.y - chart.boxselect.dragStartY);
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

				var xScale = getXScale(chart);
				var yScale = getYScale(chart);
				var startX = xScale.getValueForPixel(chart.boxselect.dragStartX);
				var endX = xScale.getValueForPixel(chart.boxselect.x);
				var startY = yScale.getValueForPixel(chart.boxselect.dragStartY);
				var endY = yScale.getValueForPixel(chart.boxselect.y);

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

	Chart__default['default'].plugins.register(boxselectPlugin);

	return boxselectPlugin;

})));
