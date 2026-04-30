function createNodesFromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return Array.from(template.content.childNodes).filter((n) => n.nodeType === Node.ELEMENT_NODE);
}

function normalizeNodes(input) {
  if (input == null) return [];
  if (input instanceof MiniQuery) return input.nodes;
  if (Array.isArray(input)) return input.flatMap((item) => normalizeNodes(item));
  if (input instanceof Node) return [input];
  if (typeof input === 'string') return createNodesFromHtml(input);
  return [];
}

class MiniQuery {
  constructor(nodes) {
    this.nodes = nodes || [];
    this.length = this.nodes.length;
    for (let i = 0; i < this.nodes.length; i += 1) {
      this[i] = this.nodes[i];
    }
  }

  text(value) {
    if (value === undefined) return this.nodes[0]?.textContent ?? '';
    this.nodes.forEach((n) => { n.textContent = String(value); });
    return this;
  }

  val(value) {
    if (value === undefined) return this.nodes[0]?.value ?? '';
    this.nodes.forEach((n) => { n.value = value; });
    return this;
  }

  prop(name, value) {
    if (value === undefined) return this.nodes[0]?.[name];
    this.nodes.forEach((n) => { n[name] = value; });
    return this;
  }

  html(value) {
    if (value === undefined) return this.nodes[0]?.innerHTML ?? '';
    this.nodes.forEach((n) => { n.innerHTML = value; });
    return this;
  }

  addClass(names) {
    const classes = String(names || '').split(/\s+/).filter(Boolean);
    this.nodes.forEach((n) => n.classList.add(...classes));
    return this;
  }

  removeClass(names) {
    const classes = String(names || '').split(/\s+/).filter(Boolean);
    this.nodes.forEach((n) => n.classList.remove(...classes));
    return this;
  }

  show() {
    this.nodes.forEach((n) => { n.style.display = ''; });
    return this;
  }

  hide() {
    this.nodes.forEach((n) => { n.style.display = 'none'; });
    return this;
  }

  on(event, handler) {
    this.nodes.forEach((n) => n.addEventListener(event, handler));
    return this;
  }

  off(event, handler) {
    this.nodes.forEach((n) => n.removeEventListener(event, handler));
    return this;
  }

  empty() {
    this.nodes.forEach((n) => { n.innerHTML = ''; });
    return this;
  }

  append(...items) {
    this.nodes.forEach((parent) => {
      items.flatMap((item) => normalizeNodes(item)).forEach((node) => parent.appendChild(node));
    });
    return this;
  }

  prependTo(target) {
    const [parent] = normalizeNodes(target);
    if (!parent) return this;
    this.nodes.forEach((n) => parent.prepend(n));
    return this;
  }

  insertAfter(target) {
    const [ref] = normalizeNodes(target);
    if (!ref || !ref.parentNode) return this;
    const parent = ref.parentNode;
    let cursor = ref.nextSibling;
    this.nodes.forEach((n) => {
      parent.insertBefore(n, cursor);
      cursor = n.nextSibling;
    });
    return this;
  }
}

window.$ = function $(selector) {
  if (selector instanceof MiniQuery) return selector;
  if (selector instanceof Node) return new MiniQuery([selector]);
  if (typeof selector === 'string' && selector.trim().startsWith('<')) {
    return new MiniQuery(createNodesFromHtml(selector));
  }
  if (typeof selector === 'string') {
    return new MiniQuery(Array.from(document.querySelectorAll(selector)));
  }
  return new MiniQuery([]);
};
