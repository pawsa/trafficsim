"use strict";

class DescriptionBox {
    constructor(html) {
	var self = this;
	this.element = document.createElement('div');
	this.isShown = true;
	this.button = document.createElement('button');
	this.button.textContent = 'Hide';
	this.element.appendChild(this.button);
	this.text = document.createElement('span');
	this.text.innerHTML = html;
	this.element.appendChild(this.text);
	
	this.button.onclick = function() {
	    self.isShown = !self.isShown;
	    self.text.style.display = self.isShown ? 'inline' : 'none';
	    self.button.textContent = self.isShown ? 'Hide' : 'Show';
	};
    }
}

class DistributionView {
    //var minVal;
    //var maxVal;
    //var delta;
    //var histogram;

    // var element;
    constructor(minVal, maxVal, delta) {
	this.element = document.createElement('div');
	this.setRange(minVal, maxVal, delta);
    }

    setRange(minVal, maxVal, delta) {
	this.minVal = minVal;
	this.maxVal = maxVal;
	this.delta = delta;
	this.histogram = new Array();
	while (this.element.firstChild) {
	    this.element.removeChild(this.element.firstChild);
	}
	this.status = document.createElement('div');
	this.element.appendChild(this.status);

	var steps = (maxVal-minVal) / delta + 1;
	for (var i = 0; i < steps; i++) {
	    var bar = document.createElement('div');
	    bar.style.backgroundColor = 'red';
	    bar.style.height = '4px';
	    bar.style.width = '0px';
	    this.element.appendChild(bar);
	    this.histogram[i] = bar;
	    bar.numValue = 0;
	}
	this.total = 0;
	this.sum = 0;
	this.sumSquares = 0;
    }
    
    add(value) {
	var idx = Math.round((value - this.minVal)/this.delta);
	if (idx < 0) { idx = 0; }
	else if (idx >= this.histogram.length) {
	    idx = this.histogram.length - 1;
	}
	this.histogram[idx].numValue ++;
	this.total ++;
	this.sum += value;
	this.sumSquares += value * value;
    }

    update() {
	var x = new Array();
	var running = 0;
	var sumSquares = 0;
	var median = 0;
	var confidence95Count = 0.95 * this.total;
	var confidentIdx = 0;
	for (var i = 0; i < this.histogram.length; i++) {
	    x[i] = this.histogram[i].numValue;
	}
	var maxHistogram = x.reduce(function(a, b) { return Math.max(a, b); });
	for (var i = 0; i < this.histogram.length; i++) {
	    this.histogram[i].style.width = x[i]* 800 / maxHistogram + 'px';
	    running += x[i];
	    if (running < this.total * 0.5) {
		median = i;
	    }
	    if (running < confidence95Count) {
		confidentIdx = i;
	    }
	}
	var avg = this.sum/this.total;
	var deviation = Math.sqrt(this.sumSquares / this.total - avg * avg);
	this.status.textContent = (" Avg: " + avg +
				   " Median: " + (median * this.delta + this.minVal) +
				   " T(95): " + (confidentIdx * this.delta + this.minVal) +
				   " Deviation: " + deviation);
    }
}

class DelayDistribution {
    // var center;
    // var width;
    constructor(center, width) {
	this.center = center;
	this.width = width;
    }

    getValue() {
	return this.center + this.width*Math.sqrt(-Math.log(Math.random()));
    }
}

class DocView {
    // var body;
    
    constructor() {
	this.body = document.getElementsByTagName('body')[0];
    }

    addView(view) {
	this.body.appendChild(view.element);
    }
}

class ControlPanel {
    createInput(label, val, minValue, maxValue) {
	var self = this;
	var l = document.createElement('span');
	l.textContent = label;
	this.element.appendChild(l);
	var i = document.createElement('input');
	i.type = 'number';
	i.value = val;
	i.min = minValue;
	i.max = maxValue;
	i.addEventListener('change', function() { self.onChange(); });
	this.element.appendChild(i);
	return i;
    }

    constructor(noEndpoints, noDirectsPerEndpoint, departureInterval,
		travelTime, punctualityParam, flexibilityFactor) {
	this.element = document.createElement('div');
	this.element.style.border = 'solid thin blue';
	this.noEndpoints = this.createInput('# endpoints:', noEndpoints,
					    1, 100);
	this.noDirectsPerEndpoint = this.createInput('# lines/endpoint:',
						     noDirectsPerEndpoint,
						     1, noEndpoints - 1);
	this.departureInterval = this.createInput('T(between departures):',
						  departureInterval,
						  1, 120);
	this.travelTime = this.createInput('T(travel):', travelTime,
					   1, 120);
	this.punctualityParam = this.createInput('"avg" delay: ',
						 punctualityParam,
						 0, 120);
	this.flexibilityParam = this.createInput('"flexible travels %": ',
						 flexibilityFactor * 100,
						 0, 100);
    }

    bindModel(model, view) {
	this.model = model;
	this.view = view;
    }

    isValid(numericInput, label) {
	var n = Number(numericInput.value);
	var r = Number(numericInput.min) <= n && n <= Number(numericInput.max);
	if (!r) {
	    console.log('Invalid parameter value', label, n,
			numericInput.min, numericInput.max);
	}
	return r;
    }
    
    onChange() {
	if (!(this.isValid(this.noEndpoints, '#endpoints') &&
	      this.isValid(this.noDirectsPerEndpoint, '#directs/endpoint') &&
	      this.isValid(this.departureInterval, 'interval') &&
	      this.isValid(this.travelTime, 'T') &&
	      this.isValid(this.punctualityParam, 'punctuality') &&
	     	      this.isValid(this.flexibilityParam, 'flexibility%'))) {
	    return;
	}
	console.log('recalculating...');
	this.model.setParams(Number(this.noEndpoints.value),
			     Number(this.noDirectsPerEndpoint.value),
			     Number(this.departureInterval.value),
			     Number(this.travelTime.value),
			     Number(this.punctualityParam.value),
			     Number(this.flexibilityParam.value)*0.01);
	this.model.computeWithView(this.view);
	this.view.update();
    }
}

class TrafficModel {
    TRAVEL_COUNT = 20000;

    setParams(noEndpoints, noDirectsPerEndpoint, departureInterval,
	      travelTime, punctualityParam, flexibilityParam) {
	this.noEndpoints = noEndpoints;
	this.noDirectsPerEndpoint = noDirectsPerEndpoint;
	this.departureInterval = departureInterval;
	this.travelTime = travelTime;
	this.punctualityParam = punctualityParam;
	this.flexibilityParam = flexibilityParam;
    }

    computeWithView(view) {
	var nRep = this.TRAVEL_COUNT;
	var directRatio = this.noDirectsPerEndpoint / (this.noEndpoints - 1);

	var dist = new DelayDistribution(0, this.punctualityParam);
	view.setRange(this.travelTime-3,
		      this.travelTime +
		      this.punctualityParam * 5 +
		      this.departureInterval * (3 + 8* directRatio),
		      1);

	var delayBetweenSameLineDepartures = (this.departureInterval *
					      this.noDirectsPerEndpoint);
	for (var i = 0; i < nRep; i++) {
	    var hasDirectConnection = Math.random() < directRatio;
	    var isFlexibleTravel = Math.random() < this.flexibilityParam;
	    if (hasDirectConnection) {
		var arrivalTime = (isFlexibleTravel
				   ? 0 : Math.random() * delayBetweenSameLineDepartures);
		var travelDelayTime = dist.getValue();
		var directTime = (arrivalTime + this.travelTime +
				  travelDelayTime);
		view.add(directTime);
	    } else {
		var arrivalTime = (isFlexibleTravel
				   ? 0 : Math.random() * this.departureInterval);
		var travelDelayTime = dist.getValue();
		var transferTime = Math.random() * this.departureInterval;
		var indirectTime = (arrivalTime + this.travelTime +
				    travelDelayTime +
				    transferTime);
		view.add(indirectTime);
	    }
	}
    }
}


/* Test function: examines distribution visualisation and
 * DelayDistribution class. */

function distTest() {
    var doc = new DocView();

    var dv = new DistributionView();
    dv.setRange(0, 30, 1);
    var dist = new DelayDistribution(0, 10);
    doc.addView(dv);
    for (var i =0; i < 10000; i++) {
	dv.add(dist.getValue());
    }
    dv.update();
}

var DESC = `

<p>This page allows comparison of travel times for transport
networks. It uses a simple travel model with at most one transfer.</p>

<p>The page permits to configure the number of travel endpoints, the
number of directly connected endpoints - per endpoint, the time
between departures from any given endpoint, and a parameter
determining uncertainty (inverse punctuality). The last parameter is
roughly an average delay experienced during travel without
transfers.</p>

<p>The travel times are modeled as follows. For any given travel, the
program selects a random destination (endpoint). The travel time will
depend whether this endpoint is connected directly to the starting
point or a transfer is required. In both cases, the travel time
includes an actual travel time with a random delay, and an 'arrival
waiting time' proportional to the interval between departures. The
arrival waiting time reflect the assumption that passengers have to
arrive at the destination at a specific time. For an indirectly
connected endpoint, the travel time includes additionally a random
transfer time waiting for any arriving line.</p>

<p>As output, travel time distributions are shown, together with some
statistical parameters: Average travel time, median travel time, time
guaranteeing to arrive at the destination with 95% confidence, and
some deviation parameter.</p>
`;

function main() {
    var doc = new DocView();

    var desc = new DescriptionBox(DESC);
    doc.addView(desc);
    
    var nEnds = 14;
    var T = 40;
    var punctuality = 5;
    var departureInterval = 10;
    var flex = 0.5;

    var dv1 = new DistributionView();
    var dv2 = new DistributionView();

    var c1 = new ControlPanel(nEnds, 3, departureInterval, T, punctuality, flex);
    var c2 = new ControlPanel(nEnds, 1, departureInterval, T, punctuality, flex);
    doc.addView(c1);
    doc.addView(dv1);
    doc.addView(c2);
    doc.addView(dv2);

    var t1 = new TrafficModel();
    var t2 = new TrafficModel();

    c1.bindModel(t1, dv1);
    c2.bindModel(t2, dv2);
    c1.onChange();
    c2.onChange();
}

//distTest();
main();
