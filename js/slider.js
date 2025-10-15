// SLIDE
class Slide extends HTMLElement {

    constructor() {
        super();

        const template = document.getElementById("slidetemplate");

        this.attachShadow({
            mode: 'open'
        });

        this.shadowRoot.append(template.content.cloneNode(true));
        this.image = undefined;
        this.container = undefined;
        this.content = undefined;
        this.img = undefined;
        this.isMobile = false;
    }

    connectedCallback() {
        this.image = this.extractImage();
        this.container = this.shadowRoot.querySelector('.slide');
        this.content = this.shadowRoot.querySelector('.slide-content');

        if (!this.image || !this.content) {
            return;
        }

        this.initImage(this.image, this.content);
        this.initTitle(this.content);

        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    resetExpand() {
        this.setExpand('max-content');
    }

    expand() {
        this.setExpand('100%');
    }

    setExpand(value) {
        if (!this.container) {
            return;
        }

        this.container.style.height = value;

        if (!this.content) {
            return;
        }

        this.content.style.height = value;
    }

    initImage(img, content) {
        const imgContainer = this.queryOrNewDiv(content, '.slide-image-container');
        const link = extractAttribute(this, 'link');

        if (!link) {
            this.addImage(imgContainer, img)
            return;
        }
        const a = document.createElement('a');
        a.classList.add('slide-link');

        imgContainer.appendChild(a);
        this.addImage(a, img);
    }

    addImage(container, img) {
        this.img = new Image();
        this.img.onload = this.onImageLoad.bind(this);

        this.img.draggable = false;
        this.img.ondragstart = () => false;

        this.img.classList.add('slide-image');

        container.appendChild(this.img);
    }

    onImageLoad() {
        this.dispatchEvent(new CustomEvent("slidereload", { bubbles: false, detail: { name: this.img.src, complete: this.img.complete } }));
    }

    initTitle(content) {
        const titleContainer = this.queryOrNewDiv(content, '.slider-sub-title-wrapper');
        const title = this.extractTitle();

        if (!title) {
            return;
        }

        const div = document.createElement('div');
        div.classList.add('slider-sub-title-element');

        titleContainer.appendChild(div);

        div.innerHTML = title;
    }

    queryOrNewDiv(container, clazz) {
        var result = container.querySelector(clazz);

        if (result == undefined || result == undefined) {
            result = document.createElement('div');
            result.classList.add(clazz);
            container.appendChild(result);
        }

        return result;
    }

    // TODO: Einzelattribute
    extractImage() {
        const imgDesktop = extractAttribute(this, 'image-desktop');
        const imgMobile = extractAttribute(this, 'image-mobile');

        // TODO: Das muss noch eingebaut werden!
        if (!imgDesktop && !imgMobile) {
            return undefined;
        }

        return { desktop: imgDesktop, mobile: imgMobile };
    }

    extractTitle() {
        if (!this.hasAttribute('title')) {
            return undefined;
        }

        return extractAttribute(this, 'title');
    }

    resize() {
        if (!this.image?.mobile) {
            return;
        }

        this.switchImg();
    }

    switchImg() {
        if (!this.img?.src || this.img.src.trim() == "") {
            return;
        }

        this.setImgRaw();
    }

    setImg() {

        const src = this.img.src;

        if (!!this.img?.src || this.img.src.trim() != "") {
            return;
        }

        this.setImgRaw();
    }

    setImgRaw() {
        const src = this.getImage();

        if (this.img.src == src) {
            return;
        }

        this.img.src = src;
    }

    getImage() {
        return isMobile() ? this.image.mobile : this.image.desktop;
    }

    get hasDesktop() {
        return (!!this.image?.desktop);
    }

    get hasMobile() {
        return (!!this.image?.mobile);
    }

    get contentHeight() {
        return this.container.offsetHeight;
    }

}

class LazyMode {

    static dynamic = new LazyMode('dynamic');
    static firstSlide = new LazyMode('first-slide');
    static off = new LazyMode('off');

    constructor(name) {
        this.name = name;
    }

    toString() {
        return `LazyMode.${this.name}`;
    }

}

// SLIDER
class Slider extends HTMLElement {

    constructor() {
        super()
        const template = document.getElementById('slidertemplate')

        this.attachShadow({
            mode: 'open'
        });

        this.shadowRoot.append(template.content.cloneNode(true));

        this.currentIndex = 0;
        this.slides = [];
        this.allSlides = [];
        this.mobileSlides = [];
        this.deltaT = 0.5;
        this.lastEvent = undefined;
        this.content = undefined;
        this.startTime = undefined;
        this.sensitive = 5;
        this.content = undefined;
        this.container = undefined;
        this.contentWrapper = undefined;
        this.slideButtonContainer = undefined;
        this.imageSrcs = new Set();
        this.lazyMode = LazyMode.off;
    }

    // ... initializing
    connectedCallback() {
        this.container = this.shadowRoot.querySelector('.slider-outer-container');
        this.content = this.shadowRoot.querySelector('.slider-content-wrapper');
        this.contentWrapper = this.shadowRoot.querySelector('.slider-content-wrapper');
        this.slideButtonContainer = this.shadowRoot.querySelector('.slider-slide-button-container');
        this.lazyMode = extractLazyAttribute(this);

        this.initSlides();
        this.initNavButtons();

        window.addEventListener("resize", this.resize.bind(this));

        this.resize();
        this.initListeners();
        this.setVisibility();
    }

    setVisibility() {
        if (this.slides.length < 1) {
            this.container.style.display = 'none';
        } else {
            this.container.style.display = 'flex';
        }
    }

    initListeners() {
        this.shadowRoot.addEventListener('click', this.onClick.bind(this));

        this.contentWrapper.addEventListener('touchstart', this.touchStart.bind(this), { passive: true });
        this.contentWrapper.addEventListener('touchend', this.touchEnd.bind(this), { passive: true });
        this.contentWrapper.addEventListener('touchmove', this.touchMove.bind(this), { passive: true });

        // Mouse events
        this.contentWrapper.addEventListener('mousedown', this.touchStart.bind(this), { passive: true });
        this.contentWrapper.addEventListener('mouseup', this.touchEnd.bind(this), { passive: true });
        this.contentWrapper.addEventListener('mouseleave', this.touchEnd.bind(this), { passive: true });
        this.contentWrapper.addEventListener('mousemove', this.touchMove.bind(this), { passive: true });
    }

    onClick(event) {
        if (!isClick(this.lastEvent, event)) {
            event.preventDefault();
            event.stopPropagation();
        } else {
            this.lastEvent = undefined;
        }

        this.cleanTouch();
    }

    touchStart(event) {
        if (!("TouchEvent" in window)) {
            event.preventDefault();
            event.stopPropagation();
        }
        this.lastEvent = event;
        this.startTime = new Date();
    }

    touchEnd(event) {
        if (this.lastEvent == undefined || this.slides.length < 2) {
            this.cleanTouch();
            return;
        }

        const x = getXFromEvent(event);
        const sigDx = this.computeDx(event);
        const dx = Math.abs(sigDx);

        if (dx < 5) {
            this.cleanTouch();
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const now = new Date();
        const bRect = this.content.getBoundingClientRect();
        const width = bRect.width;
        const left = bRect.x;

        const dt = now.getTime() - this.startTime.getTime();
        const v = dx / dt;

        if (dt <= 200 && dx >= 100) {
            const delta = Math.ceil(this.deltaT * v);

            if (delta < 1) {
                this.setIndex(this.currentIndex);
                this.cleanTouch();
                return;
            }

            const targetIndex = sigDx < 0 ? Math.max(this.currentIndex - delta, 0) : Math.min(this.currentIndex + delta, this.slides.length - 1);

            this.setIndex(targetIndex);
            this.cleanTouch();
            return;
        }

        if (dx < 10) {
            this.setIndex(this.currentIndex);
            this.cleanTouch();
            return;
        }

        const delta = dx < 0 ? Math.floor(dx / width) : Math.ceil(dx / width);
        const targetIndex = sigDx < 0 ? Math.max(this.currentIndex - delta, 0) : Math.min(this.currentIndex + delta, this.slides.length - 1);

        if (targetIndex != this.currentIndex) {
            this.setIndex(targetIndex);
            this.cleanTouch();
            return;
        }

        if (Math.abs(x - left) < 0.2 * width && this.currentIndex < this.slides.length - 1) {
            this.toRight();
        } else if (Math.abs(x - bRect.right) < 0.2 * width && this.currentIndex > 0) {
            this.toLeft()
        } else {
            this.setIndex(this.currentIndex);
        }

        this.cleanTouch();
    }

    indexOf(dx, width) {
        const delta = dx < 0 ? Math.floor(dx / width) : Math.ceil(dx / width);
        return dx < 0 ? Math.max(this.currentIndex - delta, 0) : Math.min(this.currentIndex + delta, this.slides.length - 1);
    }

    cleanTouch() {
        this.lastEvent = undefined;
        this.startTime = undefined;
    }

    computeDx(event) {
        return getXFromEvent(this.lastEvent) - getXFromEvent(event);
    }

    touchMove(event) {
        if (this.slides.length < 2) {
            return;
        }

        event.stopPropagation();

        if (!this.lastEvent) {
            return;
        }

        const dx = -this.computeDx(event);

        if (dx == 0) {
            return;
        }

        const bRect = this.content.getBoundingClientRect();
        const width = bRect.width;
        const nextIdx = this.indexOf(dx, width);

        // TODO: auslagern!
        if (dx > 0) {
            if (this.currentIndex == nextIdx && nextIdx > 0) {
                this.slides[nextIdx - 1].sliderElement.setImg();
            } else {
                for (var k = nextIdx; k < this.currentIndex; k++) {
                    this.slides[k].sliderElement.setImg();
                }
            }
        } else {
            if (this.currentIndex == nextIdx && nextIdx < this.slides.length - 1) {
                this.slides[nextIdx + 1].sliderElement.setImg();
            } else {
                for (var k = this.currentIndex + 1; k <= Math.min(nextIdx, this.slides.length - 1); k++) {
                    this.slides[k].sliderElement.setImg();
                }
            }
        }

        this.slides.forEach((e, i) => {
            const style = getMoveStyle(this.currentIndex, i, dx);

            e.sliderElement.style.transition = undefined;
            e.sliderElement.style.transform = style.transform;
        })
    }

    resize() {
        const m = isMobile();

        if (m != this.isMobile) {
            this.switchLayout(m);
        }

        this.adjustSliderHeight();
    }

    switchLayout(m) {
        this.slides.forEach(element => {
            element.sliderElement.style.display = 'none';
            element.sliderButton.container.remove();
        })

        this.slides = m ? this.mobileSlides : this.allSlides;

        this.slides.forEach(element => {
            element.sliderElement.style.display = 'flex';

            if(this.slides.length>1) {
                this.slideButtonContainer.appendChild(element.sliderButton.container);
            }
        })

        if (this.currentIndex >= this.slides.length - 1) {
            this.currentIndex = this.slides.length - 1;
        }

        this.isMobile = m;
        this.setVisibility();
        this.setIndex(this.currentIndex);
    }

    slidesReload(event) {
        if (this.imageSrcs.has(event.detail.name)) {
            return;
        }

        this.imageSrcs.add(event.detail.name);
        this.adjustSliderHeight();
    }

    adjustSliderHeight() {
        if (!this.contentWrapper || this.slides.length < 1) {
            return;
        }
        let height = this.getHeight();
        this.contentWrapper.style.minHeight = `${height}px`;

        this.adjustSlides(height);
    }

    getHeight() {
        if (this.lazyMode == LazyMode.firstSlide) {
            return this.getSlideHeight(this.slides[0]);
        }

        return this.getMaxContentHeight();
    }

    adjustSlides(height) {
        const content = this.getSlides();

        content.forEach(element => {
            if (element.contentHeight < height) {
                element.expand();
            }
        })
    }

    getMaxContentHeight() {
        let height = 0
        this.slides.forEach((elm) => {
            const h = this.getSlideHeight(elm);

            if (h > height) {
                height = h;
            }
        })

        return height;
    }

    getSlideHeight(elm) {
        const element = elm.sliderElement;

        element.resetExpand();

        return element.contentHeight;
    }

    getSlides() {
        const slot = this.shadowRoot.querySelector('slot[name=slides]');
        return slot.assignedElements({ flatten: true });
    }

    initSlides() {
        const slides = this.getSlides();

        if ((slides?.length ?? 0) < 1) {
            return;
        }

        this.generateSlides(slides);

        this.slides = isMobile() ? this.mobileSlides : this.allSlides;

        this.slides.forEach(element => {
            element.sliderElement.style.display = 'flex';

            if (this.slides.length > 1) {
                this.slideButtonContainer.appendChild(element.sliderButton.container);
            }
        })

        this.handleLazy();
        this.setIndex(this.currentIndex);
    }

    handleLazy() {
        if (this.slides.length < 1) {
            return;
        }

        if (this.lazyMode != LazyMode.off) {
            this.slides[0].sliderElement.setImg();
            return
        }

        for (const slide of this.slides) {
            slide.sliderElement.setImg();
        }
    }

    generateSlides(slides) {
        slides.forEach((element) => {
            const elm = this.newSlide(element, this.allSlides.length);

            element.style.display = 'none';

            this.allSlides.push(elm);

            if (element.hasMobile) {
                const mElm = this.newSlide(element, this.mobileSlides.length);
                this.mobileSlides.push(mElm);
            }
        })
    }

    newSlide(element, index) {
        const style = getStyle(0, index);

        element.style.transform = style.transform;
        element.addEventListener('slidereload', this.slidesReload.bind(this));

        const button = this.newSlideButton(index);
        return { sliderElement: element, sliderButton: button };
    }

    newSlideButton(index) {
        const buttonContainer = document.createElement('div');

        buttonContainer.classList.add('slider-slide-button-item-container');

        const button = document.createElement('div');

        button.classList.add('slider-slide-button');

        buttonContainer.appendChild(button);

        if (index < 1) {
            button.classList.add('slider-active');
        } else {
            button.classList.remove('slider-active');
        }

        buttonContainer.addEventListener('click', () => this.setIndex(index));

        return { container: buttonContainer, button: button };
    }

    initNavButtons() {
        const outerNavButtons = this.shadowRoot.querySelectorAll('.slider-side-nav-smooth-button');

        outerNavButtons.forEach(element => {
            if(this.slides.length<2) {
                element.remove();
                return;
            }

            if (element.classList.contains('slider-side-nav-smooth-button-left')) {
                element.addEventListener('click', () => this.toLeft());
            } else {
                element.addEventListener('click', () => this.toRight());
            }
        })
    }

    // eventhandler
    toLeft() {
        this.setIndex(this.currentIndex - 1);
    }

    toRight() {
        this.setIndex(this.currentIndex + 1);
    }

    setIndex(idx) {
        const index = getIndex(idx, this.slides.length);

        // HACK!!
        if (index < this.currentIndex) {
            for (var k = index; k < this.currentIndex; k++) {
                this.slides[k].sliderElement.setImg();
            }
        } else if (this.currentIndex < index) {
            for (var k = this.currentIndex + 1; k <= index; k++) {
                this.slides[k].sliderElement.setImg();
            }
        }

        this.slides.forEach((e, i) => {
            const style = getStyle(index, i);

            e.sliderElement.style.transition = getTransition(this.currentIndex, index, this.deltaT);
            e.sliderElement.style.transform = style.transform;

            if (i == index) {
                e.sliderButton.button.classList.add('slider-active');
            } else {
                e.sliderButton.button.classList.remove('slider-active');
            }
        })

        this.currentIndex = index;
    }

    get slideCount() {
        return this.slides.length;
    }

}

customElements.define('cs-slide', Slide);
customElements.define('cs-slider', Slider);

// functions
// ===============================================================================
function extractLazyAttribute(element) {
    const value = 'lazy';

    if (!element.hasAttribute(value)) {
        return LazyMode.off;
    }

    const result = element.getAttribute(value);

    if (!result) {
        return LazyMode.dynamic;
    }

    const r = result.toString().trim().toLowerCase()

    if (r == 'first-slide') {
        return LazyMode.firstSlide;
    }

    if (r == 'dynamic' || r == '') {
        return LazyMode.dynamic;
    }

    return LazyMode.off;
}

function extractAttribute(element, value) {
    if (!element.hasAttribute(value)) {
        return undefined;
    }

    const result = element.getAttribute(value)

    if ((result?.length ?? 0) < 1) {
        return undefined;
    }

    return result;
}

function getXFromEvent(event) {
    if (event == undefined) {
        return undefined;
    }
    if (!("TouchEvent" in window)) {
        return event.clientX;
    }

    if (event instanceof TouchEvent) {
        if (event.changedTouches.length > 0) {
            return event.changedTouches[0].clientX;
        }

        if (event.touches.length > 0) {
            return event.touches[0].clientX;
        }

        if (event.targetTouches.length > 0) {
            return event.targetTouches[0].clientX;
        }
    }

    return event.clientX;
}

function isClick(lastEvent, currentEvent) {
    if(!lastEvent) {
        return true
    }

    if (!currentEvent) {
        return false;
    }

    return Math.abs(getDx(lastEvent, currentEvent)) < 5;
}

function getDx(lastEvent, currentEvent) {
    if (!lastEvent || !currentEvent) {
        return 0;
    }

    return getXFromEvent(currentEvent) - getXFromEvent(lastEvent);
}

function isMobile() {
    return isWidth(736);
}

function isWidth(value) {
    return window.matchMedia(`(max-width: ${value}px)`).matches;
}

function getStyle(currentIndex, elementIndex) {
    if (currentIndex == elementIndex) {
        return {
            transform: 'translateX(0)',
            opacity: 1
        };
    }

    if (elementIndex < currentIndex) {
        const delta = currentIndex - elementIndex

        return {
            transform: `translateX(calc(${delta} * -100%))`,
            opacity: 0
        };
    }

    const delta = elementIndex - currentIndex;

    return {
        transform: `translateX(calc(${delta} * 100%))`,
        opacity: 0
    };
}

function getMoveStyle(currentIndex, elementIndex, dx) {

    if (currentIndex == elementIndex) {
        return {
            transform: `translateX(${dx}px)`,
            opacity: 1
        };
    }

    if (elementIndex < currentIndex) {
        const delta = currentIndex - elementIndex;

        return {
            transform: `translateX(calc(${delta} * -100% + ${dx}px))`,
            opacity: 0
        };
    }

    const delta = elementIndex - currentIndex;

    return {
        transform: `translateX(calc(${delta} * 100% + ${dx}px))`,
        opacity: 0
    };
}

function getIndex(index, numberOfSlides) {
    if (numberOfSlides < 1) {
        return 0;
    }

    if (index < 0) {
        return (index + numberOfSlides) % numberOfSlides;
    }

    return index % numberOfSlides;
}

function getTransition(currentIndex, nextIndex, deltaT) {
    return `all ${deltaT}s cubic-bezier(0.455, 0.03, 0.515, 0.955)`;
}
