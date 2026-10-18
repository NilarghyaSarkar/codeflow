(function () {
  'use strict';
  var original = window.archifyLayoutBaseline;
  var container = document.querySelector('.diagram-container');
  if (!original || !container || !window.HTMLDialogElement || !globalThis.ArchifyLayoutRouting) return;
  var metadata;
  try { metadata = JSON.parse(original.querySelector('[data-archify-layout-source]').textContent); }
  catch (_) { return; }
  if (!metadata.source || metadata.source.diagram_type !== 'architecture') return;
  // Manual side/waypoint hints belong to the old arrangement. The draft owns
  // placement, so choose fresh ports as well as fresh routes after each move.
  var automaticConnections = (metadata.source.connections || []).map(function (connection) {
    return { id: connection.id, from: connection.from, to: connection.to, label: connection.label };
  });

  var launch = document.createElement('button');
  launch.id = 'btn-layout-editor';
  launch.type = 'button';
  launch.className = 'archify-layout-launch no-print';
  launch.textContent = 'Move boxes';
  launch.setAttribute('aria-haspopup', 'dialog');
  container.appendChild(launch);
  var dialog = document.createElement('dialog');
  dialog.id = 'archify-layout-editor';
  dialog.className = 'archify-layout-dialog no-print';
  dialog.setAttribute('aria-labelledby', 'archify-layout-title');
  dialog.innerHTML = '<div class="archify-layout-head"><div><h2 id="archify-layout-title">Arrange diagram</h2>' +
    '<p>Drag boxes. Connections follow automatically. Arrow keys move the selected box.</p></div>' +
    '<div class="archify-layout-actions"><button type="button" id="layout-undo">Undo</button>' +
    '<button type="button" id="layout-reset">Reset layout</button>' +
    '<button type="button" id="layout-save-json">Save layout JSON</button>' +
    '<button type="button" id="layout-save-svg">Download draft SVG</button>' +
    '<button type="button" id="layout-close">Close</button></div></div>' +
    '<div class="archify-layout-stage"></div><div class="archify-layout-status" role="status" aria-live="polite"></div>';
  document.body.appendChild(dialog);
  var stage = dialog.querySelector('.archify-layout-stage');
  var status = dialog.querySelector('.archify-layout-status');
  var undo = dialog.querySelector('#layout-undo');
  var reset = dialog.querySelector('#layout-reset');
  var svg, nodes = [], offsets = Object.create(null), history = [], drag = null, selected = null;
  var edges = [], frames = [], legend = null, legendBox = null, bounds;
  var pendingFrame = null;
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function position(node) {
    var delta = offsets[node.id] || [0, 0];
    return { id: node.id, x: node.x + delta[0], y: node.y + delta[1], width: node.width, height: node.height };
  }
  function changed() { return Object.keys(offsets).some(function (id) { return offsets[id][0] || offsets[id][1]; }); }
  function announce(message) {
    status.textContent = message || 'Draft layout. Save JSON to have the skill validate and regenerate it. Closing keeps your draft for this page session.';
    undo.disabled = !history.length;
    reset.disabled = !changed();
  }
  function findNode(id) { return nodes.find(function (node) { return node.id === id; }); }
  function select(id) {
    selected = id;
    nodes.forEach(function (node) {
      if (node.id === id) node.element.setAttribute('data-layout-selected', 'true');
      else node.element.removeAttribute('data-layout-selected');
    });
  }
  function transform(element, originalTransform, x, y) {
    if (!x && !y) {
      if (originalTransform == null) element.removeAttribute('transform');
      else element.setAttribute('transform', originalTransform);
    } else element.setAttribute('transform', 'translate(' + x + ' ' + y + ') ' + (originalTransform || ''));
  }
  function placeLabel(route, edge, positions, occupied, routes) {
    var width = edge.labelWidth, height = edge.labelHeight;
    var segments = route.points.slice(1).map(function (to, index) {
      var from = route.points[index];
      return { from: from, to: to, length: Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) };
    }).sort(function (a, b) { return b.length - a.length; });
    function intersects(a, b) {
      return a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y;
    }
    function crosses(rect, points) {
      return points.slice(1).some(function (to, index) {
        var from = points[index];
        if (from[1] === to[1]) return from[1] > rect.y - 2 && from[1] < rect.y + rect.height + 2 && Math.max(from[0], to[0]) > rect.x - 2 && Math.min(from[0], to[0]) < rect.x + rect.width + 2;
        return from[0] > rect.x - 2 && from[0] < rect.x + rect.width + 2 && Math.max(from[1], to[1]) > rect.y - 2 && Math.min(from[1], to[1]) < rect.y + rect.height + 2;
      });
    }
    var candidates = [];
    segments.forEach(function (segment) {
      [0.5, 0.25, 0.75].forEach(function (fraction) {
        var x = segment.from[0] + (segment.to[0] - segment.from[0]) * fraction;
        var y = segment.from[1] + (segment.to[1] - segment.from[1]) * fraction;
        if (segment.from[1] === segment.to[1]) {
          [7, 24, 48, 80].forEach(function (gap) { candidates.push([x, y - gap], [x, y + height + gap + 1]); });
        } else {
          [10, 30, 60, 90, 130].forEach(function (gap) { candidates.push([x + width / 2 + gap, y + 3], [x - width / 2 - gap, y + 3]); });
        }
      });
    });
    var best = null;
    candidates.forEach(function (point) {
      var rect = { x: point[0] - width / 2, y: point[1] - 10, width: width, height: height };
      var collisions = positions.concat(occupied).filter(function (obstacle) { return intersects(rect, obstacle); }).length;
      collisions += routes.filter(function (item) { return item.points && crosses(rect, item.points); }).length;
      if (rect.x < bounds.x + 4 || rect.y < bounds.y + 4 || rect.x + width > bounds.x + bounds.width - 4 || rect.y + height > bounds.y + bounds.height - 4) collisions += 10;
      var distance = Math.abs(point[0] - route.labelPoint[0]) + Math.abs(point[1] - route.labelPoint[1]);
      var score = collisions * 100000 + distance;
      if (!best || score < best.score) best = { point: point, rect: rect, score: score, blocked: collisions > 0 };
    });
    if (!best) return { point: route.labelPoint, blocked: true };
    occupied.push(best.rect);
    return best;
  }
  function labelLeader(edge, route, rect, positions) {
    edge.leader.setAttribute('visibility', 'hidden');
    if (!rect) return;
    var center = [rect.x + rect.width / 2, rect.y + rect.height / 2], nearest = null;
    route.points.slice(1).forEach(function (to, index) {
      var from = route.points[index];
      var point = [Math.max(Math.min(from[0], to[0]), Math.min(Math.max(from[0], to[0]), center[0])),
        Math.max(Math.min(from[1], to[1]), Math.min(Math.max(from[1], to[1]), center[1]))];
      var target = [Math.max(rect.x, Math.min(rect.x + rect.width, point[0])), Math.max(rect.y, Math.min(rect.y + rect.height, point[1]))];
      var distance = Math.hypot(point[0] - target[0], point[1] - target[1]);
      if (!nearest || distance < nearest.distance) nearest = { point: point, target: target, distance: distance };
    });
    if (!nearest || nearest.distance <= 18) return;
    var a = nearest.point, b = nearest.target;
    var alternatives = [[a, [b[0], a[1]], b], [a, [a[0], b[1]], b]];
    function clear(points) {
      return !positions.some(function (box) {
        return points.slice(1).some(function (to, index) {
          var from = points[index];
          if (from[1] === to[1]) return from[1] > box.y && from[1] < box.y + box.height && Math.max(from[0], to[0]) > box.x && Math.min(from[0], to[0]) < box.x + box.width;
          return from[0] > box.x && from[0] < box.x + box.width && Math.max(from[1], to[1]) > box.y && Math.min(from[1], to[1]) < box.y + box.height;
        });
      });
    }
    var points = alternatives.find(clear) || [a, b];
    edge.leader.setAttribute('d', points.map(function (point, index) { return (index ? 'L ' : 'M ') + point.join(' '); }).join(' '));
    edge.leader.setAttribute('visibility', 'visible');
  }
  function render() {
    if (!svg) return;
    var dirty = changed();
    var positions = nodes.map(position);
    var routed = dirty ? ArchifyLayoutRouting.routeConnections(positions, automaticConnections) : [];
    var blocked = false;
    var occupiedLabels = [];
    nodes.forEach(function (node) {
      var delta = offsets[node.id] || [0, 0];
      transform(node.element, node.transform, delta[0], delta[1]);
    });
    edges.forEach(function (edge, index) {
      var route = routed[index];
      if (!route || !route.points || route.points.length < 2) {
        edge.path.setAttribute('d', edge.d);
        edge.path.setAttribute('data-composition-points', edge.points);
        if (edge.mask) edge.mask.setAttribute('d', edge.d);
        if (edge.label) transform(edge.label, edge.labelTransform, 0, 0);
        if (edge.leader) edge.leader.setAttribute('visibility', 'hidden');
        edge.path.removeAttribute('data-layout-blocked');
        return;
      }
      var d = route.points.map(function (point, n) { return (n ? 'L ' : 'M ') + point[0] + ' ' + point[1]; }).join(' ');
      edge.path.setAttribute('d', d);
      edge.path.setAttribute('data-composition-points', route.points.map(function (point) { return point.join(','); }).join(';'));
      if (edge.mask) edge.mask.setAttribute('d', d);
      if (edge.label && edge.labelAnchor && route.labelPoint) {
        var placement = placeLabel(route, edge, positions, occupiedLabels, routed);
        transform(edge.label, edge.labelTransform, placement.point[0] - edge.labelAnchor[0], placement.point[1] - edge.labelAnchor[1]);
        labelLeader(edge, route, placement.rect, positions);
        if (placement.blocked) blocked = true;
      }
      if (route.blocked) { blocked = true; edge.path.setAttribute('data-layout-blocked', 'true'); }
      else edge.path.removeAttribute('data-layout-blocked');
    });
    var contentBottom = 0;
    frames.forEach(function (frame) {
      var members = positions.filter(function (node) { return frame.members.indexOf(node.id) !== -1; });
      if (!members.length) return;
      var minX = Math.min.apply(null, members.map(function (n) { return n.x; }));
      var minY = Math.min.apply(null, members.map(function (n) { return n.y; }));
      var right = Math.max.apply(null, members.map(function (n) { return n.x + n.width; }));
      var bottom = Math.max.apply(null, members.map(function (n) { return n.y + n.height; }));
      var x = dirty ? minX - frame.pad : frame.x;
      var y = dirty ? minY - frame.topPad : frame.y;
      frame.element.setAttribute('x', x);
      frame.element.setAttribute('y', y);
      frame.element.setAttribute('width', dirty ? right - minX + frame.pad * 2 : frame.width);
      frame.element.setAttribute('height', dirty ? bottom - minY + frame.topPad + frame.bottomPad : frame.height);
      if (frame.label) transform(frame.label, frame.labelTransform, x - frame.x, y - frame.y);
      contentBottom = Math.max(contentBottom, Number(frame.element.getAttribute('y')) + Number(frame.element.getAttribute('height')));
    });
    positions.forEach(function (node) { contentBottom = Math.max(contentBottom, node.y + node.height); });
    if (legend && legendBox) transform(legend, null, 0, dirty ? Math.max(0, contentBottom + 20 - legendBox.y) : 0);
    announce(blocked ? 'Some boxes or labels are crowded. Add space; the draft will need validation before delivery.' : null);
  }
  function scheduleRender() {
    if (pendingFrame != null) return;
    pendingFrame = requestAnimationFrame(function () { pendingFrame = null; render(); });
  }
  function flush() {
    if (pendingFrame != null) { cancelAnimationFrame(pendingFrame); pendingFrame = null; }
    render();
  }
  function point(event) {
    var matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  }
  function limit(node, x, y) {
    return [Math.round(Math.max(bounds.x + 40, Math.min(bounds.x + bounds.width - node.width - 40, x)) * 10) / 10,
      Math.round(Math.max(bounds.y + 40, Math.min(bounds.y + bounds.height - node.height - 70, y)) * 10) / 10];
  }
  function move(node, x, y) {
    var placed = limit(node, x, y);
    offsets[node.id] = [placed[0] - node.x, placed[1] - node.y];
    scheduleRender();
  }
  function endDrag(cancelled) {
    if (!drag) return;
    var completed = drag;
    drag = null;
    if (cancelled) offsets = Object.assign(Object.create(null), completed.before);
    else if (completed.moved) {
      history.push(completed.before);
      if (history.length > 50) history.shift();
    }
    svg.removeAttribute('data-layout-dragging');
    try { if (svg.hasPointerCapture(completed.pointerId)) svg.releasePointerCapture(completed.pointerId); } catch (_) {}
    flush();
  }
  function build() {
    svg = original.cloneNode(true);
    svg.id = 'archify-layout-canvas';
    svg.classList.add('archify-layout-canvas');
    svg.removeAttribute('style');
    svg.setAttribute('data-theme', document.documentElement.getAttribute('data-theme'));
    svg.setAttribute('data-preset', document.documentElement.getAttribute('data-preset') || 'classic');
    // Separate fragment IDs from the live reader: marker/clip/filter references
    // remain local to the draft SVG and survive standalone downloads.
    var ids = Object.create(null);
    Array.prototype.forEach.call(svg.querySelectorAll('[id]'), function (element) {
      var id = element.id; ids[id] = 'layout-draft-' + id; element.id = ids[id];
    });
    Array.prototype.forEach.call(svg.querySelectorAll('*'), function (element) {
      Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
        var value = attribute.value.replace(/url\(#([^\)]+)\)/g, function (match, id) { return ids[id] ? 'url(#' + ids[id] + ')' : match; });
        if ((attribute.name === 'href' || attribute.name === 'xlink:href') && ids[value.slice(1)]) value = '#' + ids[value.slice(1)];
        if (value !== attribute.value) element.setAttribute(attribute.name, value);
      });
    });
    ['aria-labelledby', 'aria-describedby'].forEach(function (name) {
      if (svg.hasAttribute(name)) svg.setAttribute(name, svg.getAttribute(name).split(/\s+/).map(function (id) { return ids[id] || id; }).join(' '));
    });
    stage.replaceChildren(svg);
    bounds = { x: svg.viewBox.baseVal.x, y: svg.viewBox.baseVal.y, width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height };
    nodes = metadata.nodes.map(function (node) {
      var element = Array.prototype.find.call(svg.querySelectorAll('[data-node-id]'), function (candidate) { return candidate.getAttribute('data-node-id') === node.id; });
      element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', 'Move ' + (node.label || node.id));
      return Object.assign({}, node, { element: element, transform: element.getAttribute('transform') });
    });
    edges = (metadata.source.connections || []).map(function (_, index) {
      var matched = Array.prototype.filter.call(svg.querySelectorAll('[data-edge-key]'), function (element) { return element.getAttribute('data-edge-key') === String(index); });
      var path = matched.find(function (element) { return element.tagName.toLowerCase() === 'path'; });
      var label = matched.find(function (element) { return element.tagName.toLowerCase() === 'g'; });
      var text = label && label.querySelector('text');
      var labelRect = label && label.querySelector('rect');
      var mask = path.parentElement.getAttribute('data-graph-role') === 'automatic-crossover' ? path.parentElement.querySelector('[data-graph-role="automatic-crossover-underlay"]') : null;
      var leader = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      leader.setAttribute('data-layout-label-leader', String(index)); leader.setAttribute('aria-hidden', 'true');
      leader.setAttribute('class', 'a-default'); leader.setAttribute('stroke-width', '0.8'); leader.setAttribute('stroke-dasharray', '2 3');
      leader.setAttribute('opacity', '0.65'); leader.setAttribute('pointer-events', 'none'); leader.setAttribute('visibility', 'hidden');
      leader.setAttribute('fill', 'none');
      svg.insertBefore(leader, svg.querySelector('[data-node-id]'));
      return { path: path, mask: mask, label: label, leader: leader, d: path.getAttribute('d'), points: path.getAttribute('data-composition-points'),
        labelTransform: label && label.getAttribute('transform'), labelAnchor: text ? [Number(text.getAttribute('x')), Number(text.getAttribute('y'))] : null,
        labelWidth: labelRect ? Number(labelRect.getAttribute('width')) : 40, labelHeight: labelRect ? Number(labelRect.getAttribute('height')) : 14 };
    });
    frames = metadata.boundaries.map(function (frame) {
      var element = svg.querySelector('rect[data-composition-frame-id="' + frame.index + '"]');
      var label = svg.querySelector('g[data-composition-frame-id="' + frame.index + '"]');
      return Object.assign({}, frame, { element: element, label: label, labelTransform: label && label.getAttribute('transform') });
    });
    legend = svg.querySelector('[data-legend]');
    legendBox = legend ? legend.getBBox() : null;
    select(selected);
    flush();
  }
  function open() {
    if (dialog.open) return;
    dialog.showModal();
    build();
    if (nodes.length) nodes[0].element.focus();
  }
  function close() { endDrag(true); if (dialog.open) dialog.close(); launch.focus(); }
  function resetLayout() { endDrag(true); if (changed()) history.push(copy(offsets)); offsets = Object.create(null); flush(); }
  function undoLayout() { endDrag(true); if (history.length) offsets = Object.assign(Object.create(null), history.pop()); flush(); }
  function download(blob, suffix) {
    var title = String(metadata.source.meta.title || 'architecture').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'architecture';
    var link = document.createElement('a'), url = URL.createObjectURL(blob);
    link.href = url; link.download = title + suffix;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function candidate() {
    var result = copy(metadata.source);
    if (!changed()) return result;
    var positions = nodes.map(position);
    delete result.layout;
    delete result.meta.viewBox;
    result.components.forEach(function (component) {
      var node = positions.find(function (item) { return item.id === component.id; });
      component.pos = [node.x, node.y]; delete component.row; delete component.col;
    });
    (result.connections || []).forEach(function (connection) {
      ['via', 'route', 'channelX', 'channelY', 'fromSide', 'toSide', 'labelAt', 'labelDx', 'labelDy', 'labelSegment'].forEach(function (key) { delete connection[key]; });
    });
    return result;
  }
  function downloadJson() {
    endDrag(false); flush();
    download(new Blob([JSON.stringify(candidate(), null, 2) + '\n'], { type: 'application/json' }), '-layout.json');
    announce('Layout JSON saved. Ask the skill to finalize this draft into a checked interactive diagram.');
  }
  function downloadSvg() {
    endDrag(false); flush();
    var clone = svg.cloneNode(true);
    clone.removeAttribute('id'); clone.removeAttribute('class'); clone.removeAttribute('data-layout-dragging');
    Array.prototype.forEach.call(clone.querySelectorAll('[data-archify-layout-source]'), function (element) { element.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll('[data-layout-selected]'), function (element) { element.removeAttribute('data-layout-selected'); });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', bounds.width); clone.setAttribute('height', bounds.height);
    clone.style.width = bounds.width + 'px'; clone.style.height = bounds.height + 'px'; clone.style.minWidth = '0'; clone.style.minHeight = '0';
    var style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = Array.prototype.map.call(document.querySelectorAll('style:not([data-layout-editor-style])'), function (element) { return element.textContent; }).join('\n');
    var background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('x', bounds.x); background.setAttribute('y', bounds.y); background.setAttribute('width', bounds.width); background.setAttribute('height', bounds.height);
    background.setAttribute('fill', getComputedStyle(svg).getPropertyValue('--bg').trim());
    clone.insertBefore(background, clone.firstChild); clone.insertBefore(style, clone.firstChild);
    download(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }), '-layout-draft.svg');
    announce('Draft SVG saved with your current positions.');
  }
  stage.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || !event.isPrimary) return;
    var element = event.target.closest('[data-node-id]');
    if (!element || !svg.contains(element)) return;
    var node = findNode(element.getAttribute('data-node-id')), start = point(event);
    if (!node || !start) return;
    event.preventDefault(); select(node.id); element.focus();
    drag = { node: node, pointerId: event.pointerId, start: start, clientX: event.clientX, clientY: event.clientY, position: position(node), before: copy(offsets), moved: false };
    svg.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', function (event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 3) return;
    var current = point(event); if (!current) return;
    drag.moved = true; svg.setAttribute('data-layout-dragging', 'true'); event.preventDefault();
    move(drag.node, drag.position.x + current.x - drag.start.x, drag.position.y + current.y - drag.start.y);
  });
  stage.addEventListener('pointerup', function (event) { if (drag && event.pointerId === drag.pointerId) endDrag(false); });
  stage.addEventListener('pointercancel', function (event) { if (drag && event.pointerId === drag.pointerId) endDrag(true); });
  stage.addEventListener('lostpointercapture', function (event) { if (drag && event.pointerId === drag.pointerId) endDrag(true); });
  dialog.addEventListener('keydown', function (event) {
    event.stopPropagation();
    if (event.key === 'Escape' && drag) { event.preventDefault(); endDrag(true); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undoLayout(); return; }
    var element = event.target.closest('[data-node-id]');
    var directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!element || !directions[event.key]) return;
    event.preventDefault();
    var node = findNode(element.getAttribute('data-node-id')), current = position(node), amount = event.shiftKey ? 1 : 10;
    history.push(copy(offsets)); if (history.length > 50) history.shift(); select(node.id);
    move(node, current.x + directions[event.key][0] * amount, current.y + directions[event.key][1] * amount); flush();
  });
  dialog.addEventListener('cancel', function () { endDrag(true); });
  dialog.addEventListener('close', function () { endDrag(true); launch.focus(); });
  window.addEventListener('blur', function () { endDrag(true); });
  launch.addEventListener('click', open);
  launch.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
  dialog.addEventListener('click', function (event) { event.stopPropagation(); });
  dialog.querySelector('#layout-close').addEventListener('click', close);
  undo.addEventListener('click', undoLayout); reset.addEventListener('click', resetLayout);
  dialog.querySelector('#layout-save-json').addEventListener('click', downloadJson);
  dialog.querySelector('#layout-save-svg').addEventListener('click', downloadSvg);
  Archify.layoutEditor = { open: open, close: close, reset: resetLayout, undo: undoLayout, downloadJson: downloadJson, downloadSvg: downloadSvg,
    state: function () { return { open: dialog.open, offsets: copy(offsets), dirty: changed(), undoCount: history.length, selected: selected }; } };
})();
