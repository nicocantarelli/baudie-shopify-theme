// Custom dropdown for <select-menu> (see snippets/select-menu.liquid).
// Loaded on every page by the layout, not from the snippet's own javascript
// tag: Shopify only loads snippet scripts on pages that render the snippet
// at load, and the cart drawer renders dropdowns into any page later on.
if (!customElements.get('select-menu')) {
  let selectMenuUid = 0;

  class SelectMenu extends HTMLElement {
    connectedCallback() {
      if (this.button) return;
      this.select = this.querySelector('select');
      if (!this.select) return;

      const uid = `select-menu-${++selectMenuUid}`;
      this.activeIndex = -1;
      this.handleDocumentClick = this.handleDocumentClick.bind(this);
      this.handleViewportChange = this.handleViewportChange.bind(this);

      // Combobox button: looks like the select it replaces.
      this.button = document.createElement('button');
      this.button.type = 'button';
      this.button.className = `${this.select.className} select-menu__button`;
      this.button.setAttribute('role', 'combobox');
      this.button.setAttribute('aria-haspopup', 'listbox');
      this.button.setAttribute('aria-expanded', 'false');
      this.button.setAttribute('aria-controls', `${uid}-list`);
      const label = this.select.labels && this.select.labels[0];
      if (label) {
        if (!label.id) label.id = `${uid}-label`;
        this.button.setAttribute('aria-labelledby', label.id);
        // The label points at the hidden select; send its clicks to the button.
        label.addEventListener('click', (event) => {
          event.preventDefault();
          this.button.focus();
        });
      } else if (this.select.getAttribute('aria-label')) {
        this.button.setAttribute('aria-label', this.select.getAttribute('aria-label'));
      }
      if (this.select.getAttribute('aria-describedby')) {
        this.button.setAttribute('aria-describedby', this.select.getAttribute('aria-describedby'));
      }

      // Listbox, keeping <optgroup>s as labelled groups. A hidden option (a
      // placeholder like "Choose your scent") shows on the button only.
      this.list = document.createElement('div');
      this.list.className = 'select-menu__list';
      this.list.id = `${uid}-list`;
      this.list.setAttribute('role', 'listbox');
      this.list.hidden = true;
      if (this.button.getAttribute('aria-labelledby')) {
        this.list.setAttribute('aria-labelledby', this.button.getAttribute('aria-labelledby'));
      }
      this.options = [];
      const addOption = (option, parent) => {
        const index = this.options.length;
        const el = document.createElement('div');
        el.className = 'select-menu__option';
        el.id = `${uid}-option-${index}`;
        el.setAttribute('role', 'option');
        el.innerHTML =
          '<svg class="select-menu__check" aria-hidden="true" focusable="false" width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9L10 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        const text = document.createElement('span');
        text.textContent = option.textContent.trim();
        el.appendChild(text);
        el.addEventListener('mousedown', (event) => event.preventDefault()); // keep focus on the button
        el.addEventListener('click', () => this.choose(index));
        el.addEventListener('mousemove', () => this.setActive(index));
        parent.appendChild(el);
        this.options.push({ el, option });
      };
      Array.from(this.select.children).forEach((child, groupIndex) => {
        if (child.tagName === 'OPTGROUP') {
          const group = document.createElement('div');
          group.setAttribute('role', 'group');
          const groupLabel = document.createElement('div');
          groupLabel.className = 'select-menu__group-label';
          groupLabel.id = `${uid}-group-${groupIndex}`;
          groupLabel.setAttribute('role', 'presentation');
          groupLabel.textContent = child.label;
          group.setAttribute('aria-labelledby', groupLabel.id);
          group.appendChild(groupLabel);
          Array.from(child.querySelectorAll('option'))
            .filter((option) => !option.hidden)
            .forEach((option) => addOption(option, group));
          this.list.appendChild(group);
        } else if (child.tagName === 'OPTION' && !child.hidden) {
          addOption(child, this.list);
        }
      });

      this.select.after(this.button, this.list);
      this.classList.add('select-menu--enhanced');
      this.sync();

      this.button.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
      this.button.addEventListener('keydown', (event) => this.handleKeydown(event));
      this.addEventListener('focusout', (event) => {
        if (!this.contains(event.relatedTarget)) this.close();
      });
      // Keep the button in step if the select changes some other way.
      this.select.addEventListener('change', () => this.sync());
    }

    disconnectedCallback() {
      this.removeOpenListeners();
    }

    removeOpenListeners() {
      document.removeEventListener('click', this.handleDocumentClick);
      window.removeEventListener('scroll', this.handleViewportChange, true);
      window.removeEventListener('resize', this.handleViewportChange);
    }

    // Nearest ancestor that becomes the containing block for position:fixed
    // (a transform, filter, perspective, containment or will-change), or null
    // for the viewport.
    fixedContainingBlock() {
      for (let el = this.parentElement; el && el !== document.body; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (
          cs.transform !== 'none' ||
          cs.filter !== 'none' ||
          cs.perspective !== 'none' ||
          /paint|layout|strict|content/.test(cs.contain) ||
          /transform|filter|perspective/.test(cs.willChange)
        ) {
          return el;
        }
      }
      return null;
    }

    position() {
      const rect = this.button.getBoundingClientRect();
      const block = this.fixedContainingBlock();
      const bounds = block
        ? block.getBoundingClientRect()
        : { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
      const bottomLimit = Math.min(bounds.bottom, window.innerHeight);
      const topLimit = Math.max(bounds.top, 0);
      const rightLimit = Math.min(bounds.right, window.innerWidth);

      this.list.style.minWidth = `${Math.max(rect.width, 160)}px`;
      const height = this.list.offsetHeight;
      const width = this.list.offsetWidth;
      const spaceBelow = bottomLimit - rect.bottom;
      const spaceAbove = rect.top - topLimit;
      const up = spaceBelow < height + 8 && spaceAbove > spaceBelow;
      const top = up ? rect.top - height - 4 : rect.bottom + 4;
      const left = Math.min(rect.left, rightLimit - width - 8);

      this.list.classList.toggle('select-menu__list--up', up);
      this.list.style.top = `${top - (block ? bounds.top : 0)}px`;
      this.list.style.left = `${Math.max(left, 8) - (block ? bounds.left : 0)}px`;
    }

    handleViewportChange(event) {
      if (event && event.type === 'scroll' && this.list.contains(event.target)) return;
      this.close();
    }

    get isOpen() {
      return this.button && this.button.getAttribute('aria-expanded') === 'true';
    }

    sync() {
      const selected = this.select.selectedIndex;
      this.button.textContent = selected >= 0 ? this.select.options[selected].textContent.trim() : '';
      this.options.forEach(({ el, option }) => el.setAttribute('aria-selected', String(option.selected)));
    }

    // A disabled select's list doesn't open (e.g. while its change is saved).
    open(index) {
      if (this.isOpen || this.select.disabled) return;
      this.list.hidden = false;
      this.button.setAttribute('aria-expanded', 'true');
      this.classList.add('is-open');
      this.position();
      const selected = this.options.findIndex(({ option }) => option.selected);
      this.setActive(index ?? Math.max(selected, 0));
      document.addEventListener('click', this.handleDocumentClick);
      window.addEventListener('scroll', this.handleViewportChange, true);
      window.addEventListener('resize', this.handleViewportChange);
    }

    close() {
      if (!this.isOpen) return;
      this.list.hidden = true;
      this.button.setAttribute('aria-expanded', 'false');
      this.button.removeAttribute('aria-activedescendant');
      this.classList.remove('is-open');
      this.removeOpenListeners();
    }

    setActive(index) {
      if (index < 0 || index >= this.options.length) return;
      this.activeIndex = index;
      this.options.forEach(({ el }, i) => el.classList.toggle('is-active', i === index));
      this.button.setAttribute('aria-activedescendant', this.options[index].el.id);
    }

    // The focus stays where it is: on the button when the keyboard picks (and
    // a click focuses it in most browsers). Safari doesn't focus a clicked
    // button, and pulling the focus there would show the keyboard focus ring.
    choose(index) {
      const entry = this.options[index];
      this.close();
      if (!entry || entry.option.selected) return;
      this.select.value = entry.option.value;
      this.sync();
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    handleDocumentClick(event) {
      if (!this.contains(event.target)) this.close();
    }

    handleKeydown(event) {
      const last = this.options.length - 1;
      if (!this.isOpen) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          this.open();
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          this.open(event.key === 'Home' ? 0 : last);
        }
        return;
      }
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.setActive(Math.min(this.activeIndex + 1, last));
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.setActive(Math.max(this.activeIndex - 1, 0));
          break;
        case 'Home':
          event.preventDefault();
          this.setActive(0);
          break;
        case 'End':
          event.preventDefault();
          this.setActive(last);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          this.choose(this.activeIndex);
          break;
        case 'Escape':
          event.preventDefault();
          this.close();
          break;
        case 'Tab':
          this.close();
          break;
      }
    }
  }

  customElements.define('select-menu', SelectMenu);
}
