// New Block - Updated November 28, 2024
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.59.1 */

function create_fragment(ctx) {
	let div10;
	let h30;
	let t0;
	let t1;
	let div0;
	let button0;
	let t2;
	let button1;
	let t3;
	let t4;
	let select;
	let option0;
	let t5;
	let option1;
	let t6;
	let t7;
	let div9;
	let figure0;
	let ul0;
	let div2;
	let h31;
	let t8;
	let t9;
	let p0;
	let t10;
	let t11;
	let div1;
	let a0;
	let t12;
	let t13;
	let img0;
	let img0_src_value;
	let t14;
	let figure1;
	let ul1;
	let div4;
	let h32;
	let t15;
	let t16;
	let p1;
	let t17;
	let t18;
	let div3;
	let a1;
	let t19;
	let t20;
	let img1;
	let img1_src_value;
	let t21;
	let figure2;
	let ul2;
	let div6;
	let h33;
	let t22;
	let t23;
	let p2;
	let t24;
	let t25;
	let div5;
	let a2;
	let t26;
	let t27;
	let img2;
	let img2_src_value;
	let t28;
	let figure3;
	let ul3;
	let div8;
	let h34;
	let t29;
	let t30;
	let p3;
	let t31;
	let t32;
	let div7;
	let a3;
	let t33;
	let t34;
	let img3;
	let img3_src_value;

	return {
		c() {
			div10 = element("div");
			h30 = element("h3");
			t0 = text("Featured Projects");
			t1 = space();
			div0 = element("div");
			button0 = element("button");
			t2 = text("Websites\n                        ");
			button1 = element("button");
			t3 = text("Web Apps");
			t4 = space();
			select = element("select");
			option0 = element("option");
			t5 = text("Websites");
			option1 = element("option");
			t6 = text("Web Apps");
			t7 = space();
			div9 = element("div");
			figure0 = element("figure");
			ul0 = element("ul");
			div2 = element("div");
			h31 = element("h3");
			t8 = text("Saint Andrew's Refugee Services");
			t9 = space();
			p0 = element("p");
			t10 = text("Saint Andrew's Refugee Services is a non-profit organization that helps refugee based in Egypt - i developed their website from scratch.");
			t11 = space();
			div1 = element("div");
			a0 = element("a");
			t12 = text("Visit here");
			t13 = space();
			img0 = element("img");
			t14 = space();
			figure1 = element("figure");
			ul1 = element("ul");
			div4 = element("div");
			h32 = element("h3");
			t15 = text("LivingHope Church");
			t16 = space();
			p1 = element("p");
			t17 = text("A Church website");
			t18 = space();
			div3 = element("div");
			a1 = element("a");
			t19 = text("Visit here");
			t20 = space();
			img1 = element("img");
			t21 = space();
			figure2 = element("figure");
			ul2 = element("ul");
			div6 = element("div");
			h33 = element("h3");
			t22 = text("Birth Guardians Egypt");
			t23 = space();
			p2 = element("p");
			t24 = text("Birth Guardians support for women in egypt");
			t25 = space();
			div5 = element("div");
			a2 = element("a");
			t26 = text("Visit here");
			t27 = space();
			img2 = element("img");
			t28 = space();
			figure3 = element("figure");
			ul3 = element("ul");
			div8 = element("div");
			h34 = element("h3");
			t29 = text("Flower Shop");
			t30 = space();
			p3 = element("p");
			t31 = text("Flower Shop site for a local store - Develope by just plain css");
			t32 = space();
			div7 = element("div");
			a3 = element("a");
			t33 = text("Visit here");
			t34 = space();
			img3 = element("img");
			this.h();
		},
		l(nodes) {
			div10 = claim_element(nodes, "DIV", { class: true });
			var div10_nodes = children(div10);
			h30 = claim_element(div10_nodes, "H3", { class: true });
			var h30_nodes = children(h30);
			t0 = claim_text(h30_nodes, "Featured Projects");
			h30_nodes.forEach(detach);
			t1 = claim_space(div10_nodes);
			div0 = claim_element(div10_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			button0 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			t2 = claim_text(button0_nodes, "Websites\n                        ");
			button0_nodes.forEach(detach);
			button1 = claim_element(div0_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);
			t3 = claim_text(button1_nodes, "Web Apps");
			button1_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t4 = claim_space(div10_nodes);
			select = claim_element(div10_nodes, "SELECT", { class: true });
			var select_nodes = children(select);
			option0 = claim_element(select_nodes, "OPTION", {});
			var option0_nodes = children(option0);
			t5 = claim_text(option0_nodes, "Websites");
			option0_nodes.forEach(detach);
			option1 = claim_element(select_nodes, "OPTION", {});
			var option1_nodes = children(option1);
			t6 = claim_text(option1_nodes, "Web Apps");
			option1_nodes.forEach(detach);
			select_nodes.forEach(detach);
			t7 = claim_space(div10_nodes);
			div9 = claim_element(div10_nodes, "DIV", { class: true });
			var div9_nodes = children(div9);
			figure0 = claim_element(div9_nodes, "FIGURE", { class: true });
			var figure0_nodes = children(figure0);
			ul0 = claim_element(figure0_nodes, "UL", { class: true });
			var ul0_nodes = children(ul0);
			div2 = claim_element(ul0_nodes, "DIV", {});
			var div2_nodes = children(div2);
			h31 = claim_element(div2_nodes, "H3", { class: true });
			var h31_nodes = children(h31);
			t8 = claim_text(h31_nodes, "Saint Andrew's Refugee Services");
			h31_nodes.forEach(detach);
			t9 = claim_space(div2_nodes);
			p0 = claim_element(div2_nodes, "P", { class: true });
			var p0_nodes = children(p0);
			t10 = claim_text(p0_nodes, "Saint Andrew's Refugee Services is a non-profit organization that helps refugee based in Egypt - i developed their website from scratch.");
			p0_nodes.forEach(detach);
			t11 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			a0 = claim_element(div1_nodes, "A", { class: true, href: true });
			var a0_nodes = children(a0);
			t12 = claim_text(a0_nodes, "Visit here");
			a0_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			t13 = claim_space(ul0_nodes);
			img0 = claim_element(ul0_nodes, "IMG", { src: true, class: true });
			ul0_nodes.forEach(detach);
			figure0_nodes.forEach(detach);
			t14 = claim_space(div9_nodes);
			figure1 = claim_element(div9_nodes, "FIGURE", { class: true });
			var figure1_nodes = children(figure1);
			ul1 = claim_element(figure1_nodes, "UL", { class: true });
			var ul1_nodes = children(ul1);
			div4 = claim_element(ul1_nodes, "DIV", {});
			var div4_nodes = children(div4);
			h32 = claim_element(div4_nodes, "H3", { class: true });
			var h32_nodes = children(h32);
			t15 = claim_text(h32_nodes, "LivingHope Church");
			h32_nodes.forEach(detach);
			t16 = claim_space(div4_nodes);
			p1 = claim_element(div4_nodes, "P", { class: true });
			var p1_nodes = children(p1);
			t17 = claim_text(p1_nodes, "A Church website");
			p1_nodes.forEach(detach);
			t18 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			a1 = claim_element(div3_nodes, "A", { class: true, href: true });
			var a1_nodes = children(a1);
			t19 = claim_text(a1_nodes, "Visit here");
			a1_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			t20 = claim_space(ul1_nodes);
			img1 = claim_element(ul1_nodes, "IMG", { src: true, class: true });
			ul1_nodes.forEach(detach);
			figure1_nodes.forEach(detach);
			t21 = claim_space(div9_nodes);
			figure2 = claim_element(div9_nodes, "FIGURE", { class: true });
			var figure2_nodes = children(figure2);
			ul2 = claim_element(figure2_nodes, "UL", { class: true });
			var ul2_nodes = children(ul2);
			div6 = claim_element(ul2_nodes, "DIV", {});
			var div6_nodes = children(div6);
			h33 = claim_element(div6_nodes, "H3", { class: true });
			var h33_nodes = children(h33);
			t22 = claim_text(h33_nodes, "Birth Guardians Egypt");
			h33_nodes.forEach(detach);
			t23 = claim_space(div6_nodes);
			p2 = claim_element(div6_nodes, "P", { class: true });
			var p2_nodes = children(p2);
			t24 = claim_text(p2_nodes, "Birth Guardians support for women in egypt");
			p2_nodes.forEach(detach);
			t25 = claim_space(div6_nodes);
			div5 = claim_element(div6_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			a2 = claim_element(div5_nodes, "A", { class: true, href: true });
			var a2_nodes = children(a2);
			t26 = claim_text(a2_nodes, "Visit here");
			a2_nodes.forEach(detach);
			div5_nodes.forEach(detach);
			div6_nodes.forEach(detach);
			t27 = claim_space(ul2_nodes);
			img2 = claim_element(ul2_nodes, "IMG", { src: true, class: true });
			ul2_nodes.forEach(detach);
			figure2_nodes.forEach(detach);
			t28 = claim_space(div9_nodes);
			figure3 = claim_element(div9_nodes, "FIGURE", { class: true });
			var figure3_nodes = children(figure3);
			ul3 = claim_element(figure3_nodes, "UL", { class: true });
			var ul3_nodes = children(ul3);
			div8 = claim_element(ul3_nodes, "DIV", {});
			var div8_nodes = children(div8);
			h34 = claim_element(div8_nodes, "H3", { class: true });
			var h34_nodes = children(h34);
			t29 = claim_text(h34_nodes, "Flower Shop");
			h34_nodes.forEach(detach);
			t30 = claim_space(div8_nodes);
			p3 = claim_element(div8_nodes, "P", { class: true });
			var p3_nodes = children(p3);
			t31 = claim_text(p3_nodes, "Flower Shop site for a local store - Develope by just plain css");
			p3_nodes.forEach(detach);
			t32 = claim_space(div8_nodes);
			div7 = claim_element(div8_nodes, "DIV", { class: true });
			var div7_nodes = children(div7);
			a3 = claim_element(div7_nodes, "A", { class: true, href: true });
			var a3_nodes = children(a3);
			t33 = claim_text(a3_nodes, "Visit here");
			a3_nodes.forEach(detach);
			div7_nodes.forEach(detach);
			div8_nodes.forEach(detach);
			t34 = claim_space(ul3_nodes);
			img3 = claim_element(ul3_nodes, "IMG", { src: true, class: true });
			ul3_nodes.forEach(detach);
			figure3_nodes.forEach(detach);
			div9_nodes.forEach(detach);
			div10_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h30, "class", "heading svelte-wjdl6d svelte-3ugrjv");
			attr(button0, "class", "svelte-wjdl6d active svelte-3ugrjv");
			attr(button1, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(div0, "class", "tabs svelte-wjdl6d svelte-3ugrjv");
			option0.__value = "0";
			option0.value = option0.__value;
			option1.__value = "1";
			option1.value = option1.__value;
			attr(select, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(h31, "class", "title svelte-wjdl6d svelte-3ugrjv");
			attr(p0, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(a0, "class", "link svelte-wjdl6d svelte-3ugrjv");
			attr(a0, "href", "https://stars-egypt.org/");
			attr(div1, "class", "links svelte-wjdl6d svelte-3ugrjv");
			if (!src_url_equal(img0.src, img0_src_value = "https://i.imgur.com/2o78hDm.png")) attr(img0, "src", img0_src_value);
			attr(img0, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(ul0, "class", "itms svelte-wjdl6d svelte-3ugrjv");
			attr(figure0, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(h32, "class", "title svelte-wjdl6d svelte-3ugrjv");
			attr(p1, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(a1, "class", "link svelte-wjdl6d svelte-3ugrjv");
			attr(a1, "href", "https://livinghopeepc.org/");
			attr(div3, "class", "links svelte-wjdl6d svelte-3ugrjv");
			if (!src_url_equal(img1.src, img1_src_value = "https://i.imgur.com/6Sd29CY.png")) attr(img1, "src", img1_src_value);
			attr(img1, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(ul1, "class", "itms svelte-wjdl6d svelte-3ugrjv");
			attr(figure1, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(h33, "class", "title svelte-wjdl6d svelte-3ugrjv");
			attr(p2, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(a2, "class", "link svelte-wjdl6d svelte-3ugrjv");
			attr(a2, "href", "https://birthguardians-eg.org/");
			attr(div5, "class", "links svelte-wjdl6d svelte-3ugrjv");
			if (!src_url_equal(img2.src, img2_src_value = "https://i.imgur.com/oYLTw8C.png")) attr(img2, "src", img2_src_value);
			attr(img2, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(ul2, "class", "itms svelte-wjdl6d svelte-3ugrjv");
			attr(figure2, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(h34, "class", "title svelte-wjdl6d svelte-3ugrjv");
			attr(p3, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(a3, "class", "link svelte-wjdl6d svelte-3ugrjv");
			attr(a3, "href", "https://cassiopea.vercel.app/");
			attr(div7, "class", "links svelte-wjdl6d svelte-3ugrjv");
			if (!src_url_equal(img3.src, img3_src_value = "https://i.imgur.com/LDxhTuy.png")) attr(img3, "src", img3_src_value);
			attr(img3, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(ul3, "class", "itms svelte-wjdl6d svelte-3ugrjv");
			attr(figure3, "class", "svelte-wjdl6d svelte-3ugrjv");
			attr(div9, "class", "items svelte-wjdl6d svelte-3ugrjv");
			attr(div10, "class", "section-container");
		},
		m(target, anchor) {
			insert_hydration(target, div10, anchor);
			append_hydration(div10, h30);
			append_hydration(h30, t0);
			append_hydration(div10, t1);
			append_hydration(div10, div0);
			append_hydration(div0, button0);
			append_hydration(button0, t2);
			append_hydration(div0, button1);
			append_hydration(button1, t3);
			append_hydration(div10, t4);
			append_hydration(div10, select);
			append_hydration(select, option0);
			append_hydration(option0, t5);
			append_hydration(select, option1);
			append_hydration(option1, t6);
			append_hydration(div10, t7);
			append_hydration(div10, div9);
			append_hydration(div9, figure0);
			append_hydration(figure0, ul0);
			append_hydration(ul0, div2);
			append_hydration(div2, h31);
			append_hydration(h31, t8);
			append_hydration(div2, t9);
			append_hydration(div2, p0);
			append_hydration(p0, t10);
			append_hydration(div2, t11);
			append_hydration(div2, div1);
			append_hydration(div1, a0);
			append_hydration(a0, t12);
			append_hydration(ul0, t13);
			append_hydration(ul0, img0);
			append_hydration(div9, t14);
			append_hydration(div9, figure1);
			append_hydration(figure1, ul1);
			append_hydration(ul1, div4);
			append_hydration(div4, h32);
			append_hydration(h32, t15);
			append_hydration(div4, t16);
			append_hydration(div4, p1);
			append_hydration(p1, t17);
			append_hydration(div4, t18);
			append_hydration(div4, div3);
			append_hydration(div3, a1);
			append_hydration(a1, t19);
			append_hydration(ul1, t20);
			append_hydration(ul1, img1);
			append_hydration(div9, t21);
			append_hydration(div9, figure2);
			append_hydration(figure2, ul2);
			append_hydration(ul2, div6);
			append_hydration(div6, h33);
			append_hydration(h33, t22);
			append_hydration(div6, t23);
			append_hydration(div6, p2);
			append_hydration(p2, t24);
			append_hydration(div6, t25);
			append_hydration(div6, div5);
			append_hydration(div5, a2);
			append_hydration(a2, t26);
			append_hydration(ul2, t27);
			append_hydration(ul2, img2);
			append_hydration(div9, t28);
			append_hydration(div9, figure3);
			append_hydration(figure3, ul3);
			append_hydration(ul3, div8);
			append_hydration(div8, h34);
			append_hydration(h34, t29);
			append_hydration(div8, t30);
			append_hydration(div8, p3);
			append_hydration(p3, t31);
			append_hydration(div8, t32);
			append_hydration(div8, div7);
			append_hydration(div7, a3);
			append_hydration(a3, t33);
			append_hydration(ul3, t34);
			append_hydration(ul3, img3);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div10);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(0, props = $$props.props);
	};

	return [props];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 0 });
	}
}

export { Component as default };
