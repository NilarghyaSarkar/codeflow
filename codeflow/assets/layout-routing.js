(function (root) {
  'use strict';

  // The draft editor deliberately owns this small router. It does not change
  // the authored renderer or the canonical viewer's route/export contracts.
  var CLEARANCE = 10;
  var LEAD = CLEARANCE + 2;
  var BEND_COST = 20;
  var EPSILON = 0.0001;
  var SIDES = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function rounded(value) { return Math.round(value * 1000) / 1000; }
  function same(a, b) { return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON; }
  function center(node) { return [node.x + node.width / 2, node.y + node.height / 2]; }

  function simplifyPoints(points) {
    var output = [];
    points.forEach(function (point) {
      var next = [rounded(point[0]), rounded(point[1])];
      if (output.length && same(output[output.length - 1], next)) return;
      while (output.length > 1) {
        var a = output[output.length - 2];
        var b = output[output.length - 1];
        var horizontal = Math.abs(a[1] - b[1]) < EPSILON && Math.abs(b[1] - next[1]) < EPSILON;
        var vertical = Math.abs(a[0] - b[0]) < EPSILON && Math.abs(b[0] - next[0]) < EPSILON;
        // Keep reversals: removing a U-turn can cut through an endpoint box.
        var forward = (b[0] - a[0]) * (next[0] - b[0]) + (b[1] - a[1]) * (next[1] - b[1]) >= 0;
        if (!(forward && (horizontal || vertical))) break;
        output.pop();
      }
      output.push(next);
    });
    return output;
  }

  function polylineMidpoint(points) {
    if (!points.length) return [0, 0];
    var total = 0;
    for (var i = 1; i < points.length; i += 1) {
      total += Math.abs(points[i][0] - points[i - 1][0]) + Math.abs(points[i][1] - points[i - 1][1]);
    }
    var remaining = total / 2;
    for (var j = 1; j < points.length; j += 1) {
      var from = points[j - 1];
      var to = points[j];
      var length = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
      if (length && remaining <= length) {
        return [rounded(from[0] + (to[0] - from[0]) * remaining / length), rounded(from[1] + (to[1] - from[1]) * remaining / length)];
      }
      remaining -= length;
    }
    return points[points.length - 1].slice();
  }

  function inferredSide(node, other, source) {
    if (node.id === other.id) return source ? 'right' : 'top';
    var a = center(node);
    var b = center(other);
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    if (Math.abs(dx) / (node.width + other.width) >= Math.abs(dy) / (node.height + other.height)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  }

  function port(node, side, offset) {
    var point = center(node);
    if (side === 'top' || side === 'bottom') {
      point[0] += offset;
      point[1] = node.y + (side === 'bottom' ? node.height : 0);
    } else {
      point[0] = node.x + (side === 'right' ? node.width : 0);
      point[1] += offset;
    }
    return point.map(rounded);
  }

  function expanded(node) {
    return { id: node.id, left: rounded(node.x - CLEARANCE), right: rounded(node.x + node.width + CLEARANCE),
      top: rounded(node.y - CLEARANCE), bottom: rounded(node.y + node.height + CLEARANCE) };
  }

  function pointInside(point, box) {
    return point[0] > box.left + EPSILON && point[0] < box.right - EPSILON &&
      point[1] > box.top + EPSILON && point[1] < box.bottom - EPSILON;
  }

  function segmentBlocked(a, b, box) {
    if (Math.abs(a[1] - b[1]) < EPSILON) {
      return a[1] > box.top + EPSILON && a[1] < box.bottom - EPSILON &&
        Math.max(a[0], b[0]) > box.left + EPSILON && Math.min(a[0], b[0]) < box.right - EPSILON;
    }
    if (Math.abs(a[0] - b[0]) < EPSILON) {
      return a[0] > box.left + EPSILON && a[0] < box.right - EPSILON &&
        Math.max(a[1], b[1]) > box.top + EPSILON && Math.min(a[1], b[1]) < box.bottom - EPSILON;
    }
    return true;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.map(rounded))).sort(function (a, b) { return a - b; });
  }

  // Direction-aware A* on the obstacle boundary grid. A bend has a modest
  // cost, so equal-length paths choose the simplest orthogonal route.
  function findPath(start, end, startDirection, endDirection, obstacles) {
    if (obstacles.some(function (box) { return pointInside(start, box) || pointInside(end, box); })) return null;
    var xValues = [start[0], end[0]];
    var yValues = [start[1], end[1]];
    obstacles.forEach(function (box) { xValues.push(box.left, box.right); yValues.push(box.top, box.bottom); });
    xValues.push(Math.min.apply(Math, xValues) - LEAD * 2, Math.max.apply(Math, xValues) + LEAD * 2);
    yValues.push(Math.min.apply(Math, yValues) - LEAD * 2, Math.max.apply(Math, yValues) + LEAD * 2);
    var xs = uniqueSorted(xValues);
    var ys = uniqueSorted(yValues);
    var width = xs.length;
    var height = ys.length;
    var size = width * height;
    var startNode = ys.indexOf(rounded(start[1])) * width + xs.indexOf(rounded(start[0]));
    var endNode = ys.indexOf(rounded(end[1])) * width + xs.indexOf(rounded(end[0]));
    var distances = new Float64Array(size * 2);
    distances.fill(Infinity);
    var previous = new Int32Array(size * 2);
    previous.fill(-1);
    var edgeClear = new Map();
    var heap = [];
    var sequence = 0;

    function less(a, b) { return a.f < b.f || (a.f === b.f && (a.g < b.g || (a.g === b.g && a.order < b.order))); }
    function push(entry) {
      var index = heap.length;
      heap.push(entry);
      while (index > 0) {
        var parent = (index - 1) >> 1;
        if (!less(entry, heap[parent])) break;
        heap[index] = heap[parent];
        index = parent;
      }
      heap[index] = entry;
    }
    function pop() {
      var first = heap[0];
      var last = heap.pop();
      if (heap.length) {
        var index = 0;
        while (index * 2 + 1 < heap.length) {
          var child = index * 2 + 1;
          if (child + 1 < heap.length && less(heap[child + 1], heap[child])) child += 1;
          if (!less(heap[child], last)) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
      }
      return first;
    }
    function point(index) { return [xs[index % width], ys[Math.floor(index / width)]]; }
    function heuristic(index) {
      return Math.abs(xs[index % width] - end[0]) + Math.abs(ys[Math.floor(index / width)] - end[1]);
    }
    function clear(a, b) {
      var key = Math.min(a, b) * size + Math.max(a, b);
      if (edgeClear.has(key)) return edgeClear.get(key);
      var from = point(a);
      var to = point(b);
      var allowed = !obstacles.some(function (box) { return segmentBlocked(from, to, box); });
      edgeClear.set(key, allowed);
      return allowed;
    }

    var initial = startNode * 2 + startDirection;
    distances[initial] = 0;
    push({ state: initial, g: 0, f: heuristic(startNode), order: sequence++ });
    var best = -1;
    var bestCost = Infinity;
    while (heap.length) {
      var current = pop();
      if (current.g !== distances[current.state]) continue;
      if (current.f >= bestCost) break;
      var node = Math.floor(current.state / 2);
      var direction = current.state % 2;
      if (node === endNode) {
        var cost = current.g + (direction === endDirection ? 0 : BEND_COST);
        if (cost < bestCost) { best = current.state; bestCost = cost; }
        continue;
      }
      var x = node % width;
      var y = Math.floor(node / width);
      var neighbors = [];
      if (x + 1 < width) neighbors.push([node + 1, 0]);
      if (y + 1 < height) neighbors.push([node + width, 1]);
      if (x > 0) neighbors.push([node - 1, 0]);
      if (y > 0) neighbors.push([node - width, 1]);
      neighbors.forEach(function (neighbor) {
        var nextNode = neighbor[0];
        var nextDirection = neighbor[1];
        if (!clear(node, nextNode)) return;
        var from = point(node);
        var to = point(nextNode);
        var nextCost = current.g + Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) + (direction === nextDirection ? 0 : BEND_COST);
        var nextState = nextNode * 2 + nextDirection;
        if (nextCost >= distances[nextState]) return;
        distances[nextState] = nextCost;
        previous[nextState] = current.state;
        push({ state: nextState, g: nextCost, f: nextCost + heuristic(nextNode), order: sequence++ });
      });
    }
    if (best < 0) return null;
    var path = [];
    for (var cursor = best; cursor >= 0; cursor = previous[cursor]) path.push(point(Math.floor(cursor / 2)));
    return path.reverse();
  }

  function fallback(start, startEscape, endEscape, end) {
    var middleX = rounded((startEscape[0] + endEscape[0]) / 2);
    return simplifyPoints([start, startEscape, [middleX, startEscape[1]], [middleX, endEscape[1]], endEscape, end]);
  }

  function routeConnections(nodes, connections) {
    nodes = Array.isArray(nodes) ? nodes : [];
    connections = Array.isArray(connections) ? connections : [];
    var byId = new Map();
    nodes.forEach(function (node) {
      if (node && typeof node.id === 'string' && finite(node.x) && finite(node.y) && finite(node.width) && finite(node.height) && node.width > 0 && node.height > 0 && !byId.has(node.id)) byId.set(node.id, node);
    });
    var obstacles = Array.from(byId.values()).map(expanded);
    var buckets = new Map();
    var records = connections.map(function (connection, index) {
      connection = connection || {};
      var from = byId.get(connection.from);
      var to = byId.get(connection.to);
      if (!from || !to) return null;
      var record = { from: from, to: to, index: index };
      ['from', 'to'].forEach(function (endpoint) {
        var node = record[endpoint];
        var other = endpoint === 'from' ? to : from;
        var side = Object.prototype.hasOwnProperty.call(SIDES, connection[endpoint + 'Side']) ? connection[endpoint + 'Side'] : inferredSide(node, other, endpoint === 'from');
        record[endpoint + 'Side'] = side;
        var key = node.id + '\u0000' + side;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ record: record, endpoint: endpoint, node: node, side: side, other: other });
      });
      return record;
    });
    buckets.forEach(function (bucket) {
      var horizontalSide = bucket[0].side === 'top' || bucket[0].side === 'bottom';
      bucket.sort(function (a, b) {
        var axis = horizontalSide ? 0 : 1;
        return center(a.other)[axis] - center(b.other)[axis] || a.record.index - b.record.index || (a.endpoint < b.endpoint ? -1 : 1);
      });
      var length = horizontalSide ? bucket[0].node.width : bucket[0].node.height;
      var padding = Math.min(10, length / 4);
      var spacing = bucket.length > 1 ? Math.min(16, (length - padding * 2) / (bucket.length - 1)) : 0;
      bucket.forEach(function (entry, index) {
        entry.record[entry.endpoint + 'Port'] = port(entry.node, entry.side, (index - (bucket.length - 1) / 2) * spacing);
      });
    });
    return records.map(function (record) {
      if (!record) return { points: [], labelPoint: [0, 0], blocked: true, reason: 'missing-node' };
      var start = record.fromPort;
      var end = record.toPort;
      var startVector = SIDES[record.fromSide];
      var endVector = SIDES[record.toSide];
      var startEscape = [rounded(start[0] + startVector[0] * LEAD), rounded(start[1] + startVector[1] * LEAD)];
      var endEscape = [rounded(end[0] + endVector[0] * LEAD), rounded(end[1] + endVector[1] * LEAD)];
      var leadsBlocked = obstacles.some(function (box) {
        return (box.id !== record.from.id && segmentBlocked(start, startEscape, box)) ||
          (box.id !== record.to.id && segmentBlocked(endEscape, end, box));
      });
      var path = leadsBlocked ? null : findPath(startEscape, endEscape, startVector[0] ? 0 : 1, endVector[0] ? 0 : 1, obstacles);
      var points = path ? simplifyPoints([start].concat(path, [end])) : fallback(start, startEscape, endEscape, end);
      var result = { points: points, labelPoint: polylineMidpoint(points), blocked: !path };
      if (!path) result.reason = leadsBlocked ? 'blocked-endpoint' : 'no-clear-route';
      return result;
    });
  }

  root.ArchifyLayoutRouting = Object.freeze({ routeConnections: routeConnections, polylineMidpoint: polylineMidpoint });
})(globalThis);
