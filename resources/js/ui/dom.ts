type Child = Node | string | null | undefined | false;

interface ElementOptions {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    onClick?: (event: MouseEvent) => void;
}

/** Tiny DOM builder so UI modules stay readable without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options: ElementOptions = {},
    children: Child[] = [],
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);

    if (options.className) {
        element.className = options.className;
    }

    if (options.text !== undefined) {
        element.textContent = options.text;
    }

    if (options.attrs) {
        for (const [name, value] of Object.entries(options.attrs)) {
            element.setAttribute(name, value);
        }
    }

    if (options.onClick) {
        (element as HTMLElement).addEventListener('click', options.onClick);
    }

    for (const child of children) {
        if (child) {
            element.append(child);
        }
    }

    return element;
}
