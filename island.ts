/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

export class Island extends HTMLElement {
  static tagName = "dess-island";
  static attributes = {
    dataIsland: "data-island",
  };

  async connectedCallback() {
    await this.hydrate();
  }

  hydrate() {
    this.replaceTemplates(this.getTemplates());
  }

  getTemplates() {
    return this.querySelectorAll<HTMLTemplateElement>(`template[${Island.attributes.dataIsland}]`);
  }

  replaceTemplates(templates: NodeListOf<HTMLTemplateElement>) {
    for (const node of templates) {
      node.replaceWith(node.content);
    }
  }
}

if ("customElements" in window) {
  window.customElements.define(Island.tagName, Island);
} else {
  console.error(
    "Island cannot be initiated because Window.customElements is unavailable",
  );
}
