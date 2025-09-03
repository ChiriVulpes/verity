"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
(() => {
    const baseURL = self.document?.currentScript?.dataset.baseUrl;
    /**
     * @enum {number}
     */
    const ModuleState = {
        Unprocessed: 0,
        Waiting: 1,
        Processed: 2,
        Error: 3,
    };
    /**
     * @typedef {(module: string) => any} ModuleGetter
     */
    /**
     * @typedef {(modules: string[], resolve: (module: any) => void, reject: (err?: any) => any) => void} ModuleGetterAsync
     */
    /**
     * @typedef {(getModule: ModuleGetter | ModuleGetterAsync, module: Module, ...args: any[]) => any} ModuleInitializer
     */
    /**
     * @typedef {Object} Module
     * @property {true} __esModule - Indicates that this module is an ES module.
     * @property {string} _name - The name of the module.
     * @property {ModuleState} _state - The current state of the module.
     * @property {string[]} _requirements - An array of module names that this module depends on.
     * @property {ModuleInitializer} _initializer - The function that initializes the module.
     * @property {Error} [_error] - An error that occurred during module initialization, if any.
     * @property {boolean} _init - Whether the module should be initialized immediately.
     * @property {true} [_allowRedefine] - Whether the module can be redefined.
     * @property {(module: Module) => void} _replace - A function to replace the module
     * @property {(nameOrNames: string | string[], resolve?: (module: any) => void, reject?: (err?: any) => void) => void | Module} [require] - A function to require other modules.
     * @property {any} [default] - The default export of the module.
     */
    /**
     * @type {Map<string, Module>}
     */
    const moduleMap = new Map();
    /**
     * @type {Set<string>}
     */
    const requirements = new Set();
    /** @type {string | undefined} */
    let nextName;
    /**
     * @param {string | string[]} name
     * @param {string[] | ModuleInitializer} reqs
     * @param {ModuleInitializer?} fn
     */
    function define(name, reqs, fn) {
        if (typeof name === "function" && !nextName)
            throw new Error("Cannot define module without a name");
        if (typeof name === "function")
            fn = name, name = /** @type {string} */ (nextName), nextName = undefined;
        if (Array.isArray(name)) {
            fn = /** @type {ModuleInitializer} */ (reqs);
            reqs = name;
            const src = self.document?.currentScript?.getAttribute("src") || self.document?.currentScript?.getAttribute("data-src");
            if (!src)
                throw new Error("Cannot define module without a name");
            name = src.startsWith("./") ? src.slice(2)
                : src.startsWith("/") ? src.slice(1)
                    : src.startsWith(`${location.origin}/`) ? src.slice(location.origin.length + 1)
                        : src;
            const qIndex = name.indexOf("?");
            name = qIndex === -1 ? name : name.slice(0, qIndex);
            name = baseURL && name.startsWith(baseURL) ? name.slice(baseURL.length) : name;
            name = name.endsWith(".js") ? name.slice(0, -3) : name;
            name = name.endsWith("/index") ? name.slice(0, -6) : name;
        }
        reqs ??= [];
        const existingDefinition = moduleMap.get(name);
        if (existingDefinition && !existingDefinition._allowRedefine)
            throw new Error(`Module "${name}" cannot be redefined`);
        if (typeof reqs === "function") {
            if (fn)
                throw new Error("Unsupport define call");
            fn = reqs;
            reqs = [];
        }
        const _requirements = reqs.slice(2).map(req => findModuleName(name, req));
        const initialiser = /** @type {ModuleInitializer} */ (fn);
        /**
         * @type {Module}
         */
        const module = {
            __esModule: true,
            _name: name,
            _state: ModuleState.Unprocessed,
            _requirements,
            _initializer: initialiser,
            _init: self.document?.currentScript?.dataset.init === name,
            _replace(newModule) {
                if (typeof newModule !== "object" && typeof newModule !== "function")
                    throw new Error("Cannot assign module.exports to a non-object");
                newModule._name = name;
                newModule._state = ModuleState.Unprocessed;
                newModule._requirements = _requirements;
                newModule._initializer = initialiser;
                newModule._replace = module._replace;
                moduleMap.set(name, newModule);
            },
        };
        moduleMap.set(name, module);
        for (const req of module._requirements)
            requirements.add(req);
        const preload = name.endsWith("$preload");
        if (preload) {
            if (module._requirements.length)
                throw new Error(`Module "${name}" cannot import other modules`);
            initializeModule(module);
        }
        if (initialProcessCompleted)
            processModules();
    }
    define.amd = true;
    define.nameNext = function (name) {
        nextName = name;
    };
    /**
     * @param {string} name
     */
    function allowRedefine(name) {
        const module = moduleMap.get(name);
        if (!module)
            return;
        module._allowRedefine = true;
    }
    /**
     * @param {string} name
     * @param {string[]} [requiredBy]
     */
    function getModule(name, requiredBy) {
        requiredBy ??= [];
        let module = moduleMap.get(name);
        if (!module) {
            if (name.endsWith(".js"))
                name = name.slice(0, -3);
            if (name.startsWith(".")) {
                let from = requiredBy[requiredBy.length - 1];
                if (!from.includes("/"))
                    from += "/";
                name = findModuleName(from, name);
            }
            module = moduleMap.get(name);
            if (!module)
                throw new Error(`Module "${name}" has not been declared and cannot be required`);
        }
        if (module._state === ModuleState.Unprocessed)
            module = processModule(name, module, requiredBy);
        return module;
    }
    /**
     * @param {string} name
     */
    function initializeModuleByName(name) {
        const module = getModule(name);
        if (!module)
            throw new Error(`Module "${name}" has not been declared and cannot be initialized`);
        initializeModule(module);
    }
    /**
     * @param {Module} module
     * @param {string[]} [requiredBy]
     * @param {...any} args
     */
    function initializeModule(module, requiredBy, ...args) {
        if (module._state)
            throw new Error(`Module "${module._name}" has already been processed`);
        requiredBy ??= [];
        try {
            requiredBy = [...requiredBy, module._name];
            /**
             * @param {string | string[]} nameOrNames
             * @param {(module: any) => void} [resolve]
             * @param {(err?: any) => void} [reject]
             */
            function require(nameOrNames, resolve, reject) {
                if (Array.isArray(nameOrNames)) {
                    const results = nameOrNames.map(name => getModule(name, requiredBy));
                    return resolve?.(results.length === 1 ? results[0] : results);
                }
                return getModule(nameOrNames, requiredBy);
            }
            module.require = require;
            const result = module._initializer(require, module, ...args);
            if (module.default === undefined) {
                module.default = result ?? module;
                module.__esModule = true;
            }
            const mapCopy = moduleMap.get(module._name);
            if (!mapCopy)
                throw new Error(`Module "${module._name}" has not been defined or has been removed during initialization`);
            module = mapCopy;
            module._state = ModuleState.Processed;
            injectModule(module);
        }
        catch (err) {
            module._state = ModuleState.Error;
            module._error = err;
            err.message = `[Module initialization ${module._name}] ${err.message}`;
            console.error(err);
        }
    }
    const isInjectableModuleDefaultNameRegex = /^[A-Z_$][a-zA-Z_$0-9]+$/;
    function injectModule(module) {
        const name = module._name;
        const inject = module.default ?? module;
        const moduleDefaultName = basename(name);
        if (isInjectableModuleDefaultNameRegex.test(moduleDefaultName) && !(moduleDefaultName in self))
            Object.assign(self, { [moduleDefaultName]: inject });
        for (const key of Object.keys(module)) {
            if (key !== "default" && !key.startsWith("_") && isInjectableModuleDefaultNameRegex.test(key) && !(key in self)) {
                Object.assign(self, { [key]: module[key] });
            }
        }
    }
    ////////////////////////////////////
    // Add the above functions to "self"
    //
    /**
     * @typedef {Object} SelfExtensions
     * @property {typeof define} define
     * @property {typeof getModule} getModule
     * @property {typeof initializeModuleByName} initializeModule
     * @property {(name: string) => boolean} hasModule
     * @property {typeof allowRedefine} allowRedefine
     */
    const extensibleSelf = /** @type {Window & typeof globalThis & SelfExtensions} */ (self);
    extensibleSelf.define = define;
    extensibleSelf.getModule = getModule;
    extensibleSelf.initializeModule = initializeModuleByName;
    extensibleSelf.allowRedefine = allowRedefine;
    extensibleSelf.hasModule = name => moduleMap.has(name);
    ////////////////////////////////////
    // Actually process the modules
    //
    self.document?.addEventListener("DOMContentLoaded", processModules);
    let initialProcessCompleted = false;
    async function processModules() {
        const scriptsStillToImport = Array.from(self.document?.querySelectorAll("template[data-script]") ?? [])
            .map(definition => {
            const script = /** @type {HTMLTemplateElement} */ (definition).dataset.script;
            definition.remove();
            return script;
        });
        await Promise.all(Array.from(new Set(scriptsStillToImport))
            .filter((v) => v !== undefined)
            .map(tryImportAdditionalModule));
        while (requirements.size) {
            const remainingRequirements = Array.from(requirements);
            await Promise.all(remainingRequirements.map(tryImportAdditionalModule));
            for (const req of remainingRequirements)
                requirements.delete(req);
        }
        for (const [name, module] of moduleMap.entries())
            if (module._init)
                processModule(name, module);
        initialProcessCompleted = true;
    }
    /**
     * @param {string} req
     */
    async function tryImportAdditionalModule(req) {
        if (moduleMap.has(req))
            return;
        await importAdditionalModule(req);
        if (!moduleMap.has(req))
            throw new Error(`The required module '${req}' could not be asynchronously loaded.`);
    }
    /**
     * @param {string} req
     */
    async function importAdditionalModule(req) {
        if (self.document) {
            const script = document.createElement("script");
            document.head.appendChild(script);
            /** @type {Promise<void>} */
            const promise = new Promise(resolve => script.addEventListener("load", () => resolve()));
            script.src = `/script/${req}.js`;
            return promise;
        }
        else {
            self.importScripts(`/script/${req}.js`);
        }
    }
    /**
     * @param {string} name
     * @param {Module | undefined} module
     * @param {string[]} requiredBy
     */
    function processModule(name, module = moduleMap.get(name), requiredBy = []) {
        if (!module)
            throw new Error(`No "${name}" module defined`);
        if (module._state === ModuleState.Waiting)
            throw new Error(`Circular dependency! Dependency chain: ${[...requiredBy, name].map(m => `"${m}"`).join(" > ")}`);
        if (!module._state) {
            module._state = ModuleState.Waiting;
            const args = module._requirements
                .map(req => processModule(req, undefined, [...requiredBy, name]));
            module._state = ModuleState.Unprocessed;
            initializeModule(module, requiredBy, ...args);
        }
        return moduleMap.get(name);
    }
    ////////////////////////////////////
    // Utils
    //
    /**
     * @param {string} name
     * @param {string} requirement
     */
    function findModuleName(name, requirement) {
        let root = dirname(name);
        if (requirement.startsWith("./"))
            return join(root, requirement.slice(2));
        while (requirement.startsWith("../"))
            root = dirname(root), requirement = requirement.slice(3);
        return requirement; // join(root, requirement);
    }
    /**
     * @param {string} name
     */
    function dirname(name) {
        const lastIndex = name.lastIndexOf("/");
        return lastIndex === -1 ? "" : name.slice(0, lastIndex);
    }
    /**
     * @param {string} name
     */
    function basename(name) {
        const lastIndex = name.lastIndexOf("/");
        return name.slice(lastIndex + 1);
    }
    /**
     * @param  {...string} path
     */
    function join(...path) {
        return path.filter(p => p).join("/");
    }
})();
define("component/core/Button", ["require", "exports", "kitsui"], function (require, exports, kitsui_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Button = (0, kitsui_1.Component)('button', (component) => {
        const button = component.style('button');
        const buttonText = (0, kitsui_1.Component)().style('button-text').appendTo(button);
        button.extendJIT('text', button => buttonText.text.rehost(button));
        const disabledReasons = (0, kitsui_1.State)(new Set());
        const disabled = disabledReasons.mapManual(reasons => !!reasons.size);
        const unsubscribeStates = new Map();
        const unsubscribeReasons = new Map();
        return button
            .style.bind(disabled, 'button--disabled')
            .style.bind(button.hoveredOrHasFocused, 'button--hover')
            .attributes.bind(disabled, 'disabled')
            .attributes.bind(disabled, 'aria-disabled', 'true')
            .extend(button => ({
            disabled,
            textWrapper: buttonText,
            setDisabled(disabled, reason) {
                unsubscribeReasons.get(reason)?.();
                unsubscribeReasons.delete(reason);
                if (disabled)
                    disabledReasons.value.add(reason);
                else
                    disabledReasons.value.delete(reason);
                disabledReasons.emit();
                return button;
            },
            bindDisabled(state, reason) {
                unsubscribeReasons.get(reason)?.();
                unsubscribeReasons.delete(reason);
                const unsubscribe = state.use(button, value => {
                    if (value)
                        disabledReasons.value.add(reason);
                    else
                        disabledReasons.value.delete(reason);
                    disabledReasons.emit();
                });
                const map = unsubscribeStates.get(state) ?? new Map();
                unsubscribeStates.set(state, map);
                map.set(unsubscribe, reason);
                return button;
            },
            unbindDisabled(state) {
                const map = unsubscribeStates.get(state);
                if (map)
                    for (const [unsubscribe, reason] of map) {
                        unsubscribe();
                        unsubscribeReasons.delete(reason);
                    }
                unsubscribeStates.delete(state);
                return button;
            },
        }));
    });
    exports.default = Button;
});
define("component/core/Paragraph", ["require", "exports", "kitsui"], function (require, exports, kitsui_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = (0, kitsui_2.Component)(component => {
        return component.style('paragraph');
    });
});
define("component/core/Lore", ["require", "exports", "component/core/Paragraph", "kitsui"], function (require, exports, Paragraph_1, kitsui_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Paragraph_1 = __importDefault(Paragraph_1);
    exports.default = (0, kitsui_3.Component)(component => component.and(Paragraph_1.default).style('lore'));
});
define("component/core/Card", ["require", "exports", "component/core/Lore", "component/core/Paragraph", "kitsui"], function (require, exports, Lore_1, Paragraph_2, kitsui_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Lore_1 = __importDefault(Lore_1);
    Paragraph_2 = __importDefault(Paragraph_2);
    const Card = (0, kitsui_4.Component)((component) => {
        let header;
        // const flush = State(false)
        return component.style('card')
            // .style.bind(flush, 'card--flush')
            // .style.bind(State.Every(component, flush, component.hoveredOrHasFocused), 'card--flush--hover')
            .extend(card => ({
            header: undefined,
            headerText: undefined,
            description: undefined,
            descriptionText: undefined,
            // flush,
        }))
            .extendJIT('header', card => header ??= (0, kitsui_4.Component)()
            .style('card-header')
            // .style.bind(flush, 'card-header--flush')
            .tweak(header => {
            const text = (0, kitsui_4.Component)().style('card-header-text').appendTo(header);
            header.extendJIT('text', header => text.text.rehost(header));
        })
            .prependTo(card))
            .extendJIT('descriptionText', card => card.description.text.rehost(card))
            .extendJIT('description', card => (0, Paragraph_2.default)().and(Lore_1.default)
            .style('card-description')
            // .style.bind(flush, 'card-description--flush')
            .insertTo(card, 'after', header))
            .extendJIT('headerText', card => card.header.text.rehost(card));
    });
    exports.default = Card;
});
define("component/core/Image", ["require", "exports", "kitsui", "kitsui/utility/Task"], function (require, exports, kitsui_5, Task_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Task_1 = __importDefault(Task_1);
    exports.default = (0, kitsui_5.Component)('img', (component, src) => {
        src = kitsui_5.State.get(src);
        return component.replaceElement('img')
            .style('image')
            .tweak(image => {
            let abort;
            src.use(image, async (src) => {
                abort?.abort();
                abort = new AbortController();
                const signal = abort.signal;
                component.attributes.remove('src');
                component.style.remove('image--loaded');
                await Task_1.default.yield();
                if (signal.aborted)
                    return;
                component.attributes.set('src', src);
            });
        })
            .event.subscribe('load', () => {
            component.style('image--loaded');
        });
    });
});
define("component/App", ["require", "exports", "component/core/Button", "component/core/Card", "component/core/Image", "component/core/Lore", "component/core/Paragraph", "kitsui", "kitsui/component/Slot", "kitsui/utility/FocusListener", "kitsui/utility/InputBus"], function (require, exports, Button_1, Card_1, Image_1, Lore_2, Paragraph_3, kitsui_6, Slot_1, FocusListener_1, InputBus_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Button_1 = __importDefault(Button_1);
    Card_1 = __importDefault(Card_1);
    Image_1 = __importDefault(Image_1);
    Lore_2 = __importDefault(Lore_2);
    Paragraph_3 = __importDefault(Paragraph_3);
    Slot_1 = __importDefault(Slot_1);
    FocusListener_1 = __importDefault(FocusListener_1);
    InputBus_1 = __importDefault(InputBus_1);
    exports.default = (0, kitsui_6.Component)(component => {
        const app = component.style('app');
        const displayModeSetting = (0, kitsui_6.State)(localStorage.getItem('displayMode'));
        displayModeSetting.useManual(setting => !setting ? localStorage.removeItem('displayMode') : localStorage.setItem('displayMode', setting));
        const displayMode = displayModeSetting.mapManual(setting => setting ?? 'full');
        const truthModeSetting = (0, kitsui_6.State)(localStorage.getItem('truthMode'));
        truthModeSetting.useManual(setting => !setting ? localStorage.removeItem('truthMode') : localStorage.setItem('truthMode', setting));
        const truthMode = truthModeSetting.mapManual(setting => setting ?? 'default');
        (0, kitsui_6.Component)()
            .style('app-header')
            .append((0, kitsui_6.Component)()
            .style('app-header-title')
            .text.set(quilt => quilt['title']()))
            .append((0, kitsui_6.Component)()
            .style('app-header-subtitle')
            .text.set(quilt => quilt['subtitle']()))
            .appendTo(app);
        (0, kitsui_6.Component)()
            .style('app-more')
            .text.set(quilt => quilt['more']())
            .appendToWhen(displayMode.equals('full'), app);
        (0, kitsui_6.Component)()
            .style('app-settings')
            .append((0, Button_1.default)()
            .style('app-settings-button')
            .text.bind(displayMode.mapManual(displayMode => quilt => quilt[`settings/display-mode/${displayMode}`]()))
            .event.subscribe('click', () => {
            displayModeSetting.value = {
                full: 'compact',
                compact: 'icons',
                icons: 'full',
            }[displayMode.value];
        }))
            .append((0, Button_1.default)()
            .style('app-settings-button')
            .text.bind(truthMode.mapManual(truthMode => quilt => quilt[`settings/truth-mode/${truthMode}`]()))
            .event.subscribe('click', () => {
            truthModeSetting.value = {
                default: 'doubled',
                doubled: 'default',
            }[truthMode.value];
        }))
            .appendTo(app);
        InputBus_1.default.event.subscribe('Down', (event, input) => {
            if (input.use(' ')) {
                truthModeSetting.value = {
                    default: 'doubled',
                    doubled: 'default',
                }[truthMode.value];
            }
        });
        ////////////////////////////////////
        //#region Reset
        const resetting = (0, kitsui_6.State)(false);
        let resetTimeout;
        component.style.bind(resetting, 'app--resetting');
        InputBus_1.default.event.subscribe('Down', (event, input) => {
            if (input.use('Escape') && (InputBus_1.default.getPressDuration('Escape') ?? 0) < 300) {
                resetting.value = true;
                window.setTimeout(reset, 500);
            }
        });
        InputBus_1.default.event.subscribe('Up', (event, input) => {
            if (input.use('Escape')) {
                resetting.value = false;
                window.clearTimeout(resetTimeout);
            }
        });
        const onReset = [];
        function reset() {
            resetting.value = false;
            for (const fn of onReset)
                fn();
        }
        const resetPredicates = [];
        function isReset() {
            return resetPredicates.every(fn => fn());
        }
        const cards = [];
        const Card = (0, kitsui_6.Component)((component, getFormState) => {
            const card = component.and(Card_1.default)
                .style('app-card')
                .style.bind(displayMode.notEquals('full'), 'app-card--compact')
                .tabIndex(getFormState ? 'auto' : undefined)
                .appendTo(app)
                .extend(card => ({
                getFormState: getFormState || undefined,
            }));
            if (getFormState) {
                InputBus_1.default.event.subscribe('Down', (event, input) => {
                    if (!card.contains(input.targetElement))
                        return;
                    if (input.targetElement?.closest('label, button, input'))
                        return;
                    if (input.use('MouseLeft'))
                        FocusListener_1.default.focus(card.element, true);
                });
                card.style.bind(card.hasFocused, 'app-card--focus');
            }
            card.header
                .style('app-card-header')
                .style.bind(displayMode.notEquals('full'), 'app-card-header--compact');
            card.description
                .style('app-card-description')
                .appendToWhen(displayMode.equals('full'), card);
            cards.push(card);
            return card;
        });
        function nextCard() {
            const focusedCardIndex = cards.findIndex(card => card.hasFocused.value);
            const nextCard = cards[focusedCardIndex + 1] || cards[0];
            nextCard.focus();
        }
        onReset.push(() => cards[0].focus());
        resetPredicates.push(() => cards.every(card => !card.getFormState || card.getFormState() === 'reset'));
        app.onRooted(() => {
            InputBus_1.default.event.subscribe('Down', (event, input) => {
                if (cards.some(card => card.hasFocused.value))
                    return;
                if (!input.use('MouseLeft'))
                    return;
                if (isReset()) {
                    cards[0].focus();
                    return;
                }
                for (const card of cards)
                    if (card.getFormState && card.getFormState() !== 'complete') {
                        card.focus();
                        return;
                    }
            });
        });
        const CalloutButton = (0, kitsui_6.Component)((component, shape, name) => {
            const checked = (0, kitsui_6.State)(false);
            const radio = (0, kitsui_6.Component)('input')
                .attributes.set('type', 'radio')
                .attributes.set('name', name)
                .style('callout-button-checkbox')
                .event.subscribe('change', (event, { recursive } = { recursive: false }) => {
                checked.value = event.host.element.checked;
                if (recursive)
                    return;
                const radioButtonsWithSameName = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
                for (const button of radioButtonsWithSameName)
                    if (button !== event.host.element)
                        (button.component?.event).emit('change', { recursive: true });
            });
            return component.replaceElement('label')
                .and(Button_1.default)
                .style('callout-button')
                .style.bind(checked, 'callout-button--checked')
                .append(radio)
                .append((0, Image_1.default)(`/static/image/${shape}.png`)
                .style('callout-button-image'))
                .extend(calloutButton => ({
                state: checked,
                select() {
                    checked.value = true;
                    radio.element.checked = true;
                },
                deselect() {
                    checked.value = false;
                    radio.element.checked = false;
                },
                toggle(selected) {
                    if (selected)
                        calloutButton.select();
                    else
                        calloutButton.deselect();
                },
            }));
        });
        const Callout = (0, kitsui_6.Component)((component, options) => {
            const name = Math.random().toString(36).slice(2);
            const state = (0, kitsui_6.State)(undefined);
            const map = new Map(options.map(option => [option, CalloutButton(option, name)
                    .tweak(button => button.state.subscribeManual(checked => checked && (state.value = option))),
            ]));
            return component.style('callout')
                .style.setVariable('callout-button-option-count', options.length)
                .append((0, kitsui_6.Component)()
                .style('callout-button-list')
                .append(...map.values()))
                .append((0, kitsui_6.Component)()
                .style('callout-label')
                .style.bind(state.mapManual(state => !state ? false : shadowDupes[shadowLetterMap[state]] || truthDupes[reverse3DMap[state]]), 'callout-label--dupe')
                .text.bind(state.mapManual(state => !state ? '\xa0' : quilt => quilt[`shape/${state}`]())))
                // .append(Component()
                // 	.style('callout-preview')
                // 	.appendWhen(state.truthy, Image(state.mapManual(state => `/static/image/${state}.png`)))
                // )
                .extend(callout => ({
                state,
                select(shape) {
                    state.value = shape;
                    for (const [option, button] of map)
                        button.toggle(option === shape);
                },
            }));
        });
        const shadowCalloutMap = { s: 'quadrate', c: 'orbicular', t: 'trigon' };
        const shadowLetterMap = { quadrate: 's', orbicular: 'c', trigon: 't' };
        const typedShadowCallout = (0, kitsui_6.State)('');
        const shadowCallout = (0, kitsui_6.State)('   ');
        onReset.push(() => {
            typedShadowCallout.value = '';
            shadowCallout.value = '   ';
        });
        const shadowDupesMap = shadowCallout.mapManual(callout => {
            return {
                s: callout.replaceAll('s', '').length < 2,
                c: callout.replaceAll('c', '').length < 2,
                t: callout.replaceAll('t', '').length < 2,
            };
        });
        const shadowDupes = Object.fromEntries(Object.keys(shadowCalloutMap)
            .map(letter => [letter, shadowDupesMap.mapManual(map => map[letter])]));
        const hasShadowDupe = shadowDupesMap.mapManual(dupes => Object.values(dupes).includes(true));
        const mode = (0, kitsui_6.State)('cst');
        const randomExampleShadowsCallout = ['cst', 'cts', 'sct', 'stc', 'tsc', 'tcs'][Math.floor(Math.random() * 6)];
        const getShadowsState = () => (typedShadowCallout.value === '' && shadowCallout.value === '   ' ? 'reset'
            : shadowCallout.value.replaceAll(' ', '').length === 3 ? 'complete'
                : 'modified');
        const shadowsCard = Card(getShadowsState)
            .tweak(card => card.headerText.set(quilt => quilt['card/callout/title']()))
            .tweak(card => card.descriptionText.set(quilt => quilt['card/callout/description'](randomExampleShadowsCallout.toUpperCase())))
            .append((0, kitsui_6.Component)()
            .style('callout-text')
            .append((0, Slot_1.default)().use(kitsui_6.State.UseManual({ callout: shadowCallout, mode }), (slot, { callout, mode }) => {
            for (const letter of callout)
                (0, kitsui_6.Component)()
                    .style('callout-text-letter')
                    .text.set(letter === ' ' ? '_' : mode === 'cst' ? letter : letter === 'c' ? 'o' : letter === 's' ? 'q' : letter)
                    .style.bind(shadowDupes[letter], 'callout-text-letter--dupe')
                    .appendTo(slot);
        })))
            .append((0, kitsui_6.Component)()
            .style('callout-list')
            .append((0, Slot_1.default)().use(shadowCallout.mapManual(callout => callout.length), (slot, length) => {
            for (let i = 0; i < length; i++) {
                const calloutSelector = Callout(['orbicular', 'quadrate', 'trigon']).appendTo(slot);
                calloutSelector.state.useManual(selected => {
                    const letter = selected && shadowLetterMap[selected];
                    const newCalloutValue = (shadowCallout.value.slice(0, i) + (letter || ' ') + shadowCallout.value.slice(i + 1));
                    if (shadowCallout.value !== newCalloutValue) {
                        shadowCallout.value = newCalloutValue;
                        typedShadowCallout.value = '';
                    }
                });
                shadowCallout.use(calloutSelector, callout => calloutSelector.select(shadowCalloutMap[callout[i]]));
            }
        })));
        InputBus_1.default.event.subscribe('Down', (event, input) => {
            if (!shadowsCard.hasFocused.value)
                return;
            let modified = false;
            let newCalloutValue = typedShadowCallout.value;
            if (input.use('c') || input.use('C')) {
                mode.value = 'cst';
                newCalloutValue += 'c';
            }
            // if (input.use('o') || input.use('O')) {
            // 	mode.value = 'oqt'
            // 	newCalloutValue += 'c'
            // }
            if (input.use('s') || input.use('S')) {
                mode.value = 'cst';
                newCalloutValue += 's';
            }
            // if (input.use('q') || input.use('Q')) {
            // 	mode.value = 'oqt'
            // 	newCalloutValue += 's'
            // }
            if (input.use('t') || input.use('T'))
                newCalloutValue += 't';
            if (input.use('Backspace')) {
                modified = true;
                newCalloutValue = shadowCallout.value.trimEnd().slice(0, -1).trimEnd();
            }
            newCalloutValue = newCalloutValue.slice(0, 3);
            if (typedShadowCallout.value !== newCalloutValue || modified) {
                typedShadowCallout.value = newCalloutValue;
                shadowCallout.value = `${typedShadowCallout.value[0] || ' '}${typedShadowCallout.value[1] || ' '}${typedShadowCallout.value[2] || ' '}`;
                if (shadowCallout.value.replaceAll(' ', '').length === 3)
                    nextCard();
            }
        });
        const callout3DMap = {
            ss: 'cuboid',
            cc: 'spheric',
            tt: 'pyramidic',
            sc: 'cylindric',
            cs: 'cylindric',
            tc: 'conoid',
            ct: 'conoid',
            ts: 'trilateral',
            st: 'trilateral',
        };
        const reverse3DMap = Object.fromEntries(Object.entries(callout3DMap)
            .map(([k, v]) => [v, k]));
        const typedTruthCallout = (0, kitsui_6.State)('');
        const truthsCallout = (0, kitsui_6.State)(['  ', '  ', '  ']);
        onReset.push(() => {
            truthsCallout.value = ['  ', '  ', '  '];
        });
        const truthDupesMap = truthsCallout.mapManual(callouts => {
            return {
                s: callouts.flatMap(callout => [...callout]).filter(l => l === 's').length > 2,
                c: callouts.flatMap(callout => [...callout]).filter(l => l === 'c').length > 2,
                t: callouts.flatMap(callout => [...callout]).filter(l => l === 't').length > 2,
            };
        });
        const truthDupes = Object.fromEntries(Object.keys(callout3DMap)
            .map(callout => [callout, truthDupesMap.mapManual(map => [...callout].some(letter => map[letter]))]));
        const hasTruthDupe = truthDupesMap.mapManual(dupes => Object.values(dupes).includes(true));
        const getTruthState = () => (typedTruthCallout.value === '' && truthsCallout.value.every(callout => callout === '  ') ? 'reset'
            : truthsCallout.value.flatMap(callout => [...callout]).filter(l => l !== ' ').length === 6 ? 'complete'
                : 'modified');
        const truthsCard = Card(getTruthState)
            .tweak(card => card.headerText.set(quilt => quilt['card/truth/title']()))
            .tweak(card => card.descriptionText.set(quilt => quilt['card/truth/description']()))
            .append((0, kitsui_6.Component)()
            .style('callout-text', 'callout-text--doubled')
            .append((0, Slot_1.default)().use(truthsCallout, (slot, truths) => {
            for (const callout of truths) {
                (0, kitsui_6.Component)()
                    .style('callout-text-letter', 'callout-text-letter--doubled')
                    .append(...callout.split('').map(letter => (0, kitsui_6.Component)()
                    .style('callout-text-letter')
                    .text.set(letter === ' ' ? '_' : letter)))
                    .style.bind(truthDupes[callout] || false, 'callout-text-letter--dupe')
                    .appendTo(slot);
            }
        })))
            .append((0, kitsui_6.Component)()
            .style('callout-list')
            .append((0, Slot_1.default)().use(shadowCallout.mapManual(callout => callout.length), (slot, length) => {
            for (let i = 0; i < length; i++) {
                const calloutSelector = Callout(['spheric', 'cuboid', 'pyramidic', 'cylindric', 'conoid', 'trilateral']).appendTo(slot);
                calloutSelector.state.useManual(selected => {
                    const oldCalloutValue = [...truthsCallout.value[i]].sort().join('');
                    const newCalloutValue = !selected ? '  ' : reverse3DMap[selected];
                    if (oldCalloutValue !== newCalloutValue) {
                        truthsCallout.value = [...truthsCallout.value.slice(0, i), newCalloutValue, ...truthsCallout.value.slice(i + 1)];
                        typedTruthCallout.value = '';
                    }
                });
                truthsCallout.use(calloutSelector, callout => calloutSelector.select(callout3DMap[callout[i]]));
            }
        })));
        InputBus_1.default.event.subscribe('Down', (event, input) => {
            if (!truthsCard.hasFocused.value)
                return;
            let modified = false;
            let newCalloutValue = typedTruthCallout.value;
            if (input.use('c') || input.use('C'))
                newCalloutValue += 'c';
            if (input.use('s') || input.use('S'))
                newCalloutValue += 's';
            if (input.use('t') || input.use('T'))
                newCalloutValue += 't';
            if (input.use('Backspace')) {
                modified = true;
                const newCalloutTuple = [...truthsCallout.value];
                while (newCalloutTuple.at(-1) === '  ')
                    newCalloutTuple.pop();
                newCalloutTuple.splice(-1, Infinity);
                while (newCalloutTuple.at(-1) === '  ')
                    newCalloutTuple.pop();
                newCalloutValue = newCalloutTuple.join('');
            }
            newCalloutValue = newCalloutValue.slice(0, 6);
            if (typedTruthCallout.value !== newCalloutValue || modified) {
                typedTruthCallout.value = newCalloutValue;
                truthsCallout.value = [
                    typedTruthCallout.value.slice(0, 2).padEnd(2, ' ') || '  ',
                    typedTruthCallout.value.slice(2, 4).padEnd(2, ' ') || '  ',
                    typedTruthCallout.value.slice(4, 6).padEnd(2, ' ') || '  ',
                ];
                if (truthsCallout.value.join('').replaceAll(' ', '').length === 6)
                    nextCard();
            }
        });
        //#endregion
        ////////////////////////////////////
        (0, kitsui_6.Component)().style('app-break').appendTo(app);
        Card(null)
            .tweak(card => card.headerText.set(quilt => quilt['card/inside-goal/title']()))
            .tweak(card => card.descriptionText.set(quilt => quilt['card/inside-goal/description']()))
            .appendToWhen(kitsui_6.State.Every(app, displayMode.equals('full'), truthMode.notEquals('doubled')), app);
        const statuePositions = ['left', 'middle', 'right'];
        const graph = {};
        ////////////////////////////////////
        //#region Truths Graph
        const possibleTruths = Object.values(reverse3DMap);
        for (const truthLeft of possibleTruths) {
            for (const truthMid of possibleTruths) {
                NextPossibleTruth: for (const truthRight of possibleTruths) {
                    const state = `${truthLeft}${truthMid}${truthRight}`;
                    for (const letter of Object.values(shadowLetterMap))
                        if (state.replaceAll(letter, '').length < 4)
                            // there must have been more than 2 occurrences, which is impossible
                            continue NextPossibleTruth;
                    graph[state] ??= { connections: new Map() };
                }
            }
        }
        for (const state of Object.keys(graph)) {
            for (let i = 0; i < state.length; i++) {
                const selectLetter = state[i];
                const selectStatue = Math.floor(i / 2);
                for (let j = 0; j < state.length; j++) {
                    const destLetter = state[j];
                    const destStatue = Math.floor(j / 2);
                    if (selectLetter === destLetter || selectStatue === destStatue)
                        continue;
                    const stateSplit = state.split('');
                    stateSplit[i] = destLetter;
                    stateSplit[j] = selectLetter;
                    let stateAfterSwap = stateSplit.join('');
                    stateAfterSwap = `${[...stateAfterSwap.slice(0, 2)].sort().join('')}${[...stateAfterSwap.slice(2, 4)].sort().join('')}${[...stateAfterSwap.slice(4, 6)].sort().join('')}`;
                    const swap = {
                        components: [destLetter, selectLetter].sort().join(''),
                        positions: { [selectLetter]: selectStatue, [destLetter]: destStatue },
                    };
                    graph[state].connections.set(stateAfterSwap, swap);
                }
            }
        }
        const remainders = {
            st: 'c',
            ct: 's',
            cs: 't',
        };
        function findPath(current, target, needsRemainder, pathCost = 0, seen = []) {
            if (current === target)
                return { path: [...seen.slice(1), current], cost: pathCost };
            if (pathCost > 6)
                return null;
            const node = graph[current];
            if (!node)
                throw new Error('How did we get here?');
            seen.push(current);
            let bestOption = null;
            for (const [next, swap] of node.connections) {
                if (seen.includes(next))
                    continue; // this node has already been visited on this path
                let newNodeCost = 1;
                if (needsRemainder && !swap.components.includes(needsRemainder))
                    newNodeCost += 3;
                const result = findPath(next, target, needsRemainder ? null : remainders[swap.components] || null, pathCost + newNodeCost, seen);
                if (!result)
                    continue;
                if (!bestOption || result.cost < bestOption.cost)
                    bestOption = result;
            }
            seen.pop();
            return bestOption;
        }
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Path
        const canFitExtraStuffInPathCard = kitsui_6.State.Every(app, displayMode.equals('full'), truthMode.notEquals('doubled'));
        Card(null)
            .tweak(card => card.headerText.set(quilt => quilt['card/outside-goal/title']()))
            .tweak(card => card.descriptionText.set(quilt => quilt['card/outside-goal/description']()))
            .tweak(card => card.description.style.bind(truthMode.equals('doubled'), 'app-card-description--hidden'))
            .tweak(card => card.header.style.bind(truthMode.equals('doubled'), 'app-card-header--doubled'))
            .append((0, Slot_1.default)().use(kitsui_6.State.UseManual({ truthMode, shadowCallout, truthsCallout, hasShadowDupe, hasTruthDupe, canFitExtraStuffInPathCard }), (slot, { truthMode, shadowCallout, truthsCallout, hasShadowDupe, hasTruthDupe }) => {
            if (hasShadowDupe || hasTruthDupe) {
                (0, kitsui_6.Component)()
                    .style('app-card-heading')
                    .text.set(quilt => quilt['card/outside-goal/message/has-dupe/title']())
                    .appendTo(slot);
                (0, Paragraph_3.default)().and(Lore_2.default)
                    .text.set(quilt => quilt['card/outside-goal/message/shared/issue/description']())
                    .appendTo(slot);
                return;
            }
            if (shadowCallout.replaceAll(' ', '').length < 3 || truthsCallout.join('').replaceAll(' ', '').length < 6) {
                (0, kitsui_6.Component)()
                    .style('app-card-heading')
                    .text.set(quilt => quilt['card/outside-goal/message/placeholder/title']())
                    .appendTo(slot);
                (0, Paragraph_3.default)().and(Lore_2.default)
                    .text.set(quilt => quilt['card/outside-goal/message/placeholder/description']())
                    .appendTo(slot);
                return;
            }
            // calc time
            const initial = truthsCallout.map(c => [...c].sort().join('')).join('');
            const potentialTargetMaps = [];
            if (truthMode === 'default')
                potentialTargetMaps.push({
                    c: 'st',
                    s: 'ct',
                    t: 'cs',
                });
            else
                potentialTargetMaps.push({
                    c: 'ss',
                    s: 'tt',
                    t: 'cc',
                }, {
                    c: 'tt',
                    s: 'cc',
                    t: 'ss',
                });
            const paths = [];
            for (const potentialTargetMap of potentialTargetMaps) {
                const target = [...shadowCallout].map(letter => potentialTargetMap[letter]).join('');
                const path = findPath(initial, target, null);
                if (path)
                    paths.push([path, target]);
            }
            const [bestPath, target] = paths.sort(([a], [b]) => a.cost - b.cost).at(0) ?? [null, null];
            if (!bestPath || !target)
                throw new Error('No path found????');
            const path = bestPath.path;
            if (!bestPath.cost) {
                (0, kitsui_6.Component)()
                    .style('app-card-heading')
                    .text.set(quilt => quilt['card/outside-goal/message/truth/title']())
                    .appendToWhen(displayMode.notEquals('full'), slot);
                (0, Paragraph_3.default)().and(Lore_2.default)
                    .text.set(quilt => quilt['card/outside-goal/message/shared/issue/description']())
                    .appendToWhen(displayMode.notEquals('full'), slot);
                return;
            }
            const wrapper = (0, kitsui_6.Component)()
                .style('path')
                .style.bind(displayMode.equals('icons'), 'path--icons')
                .appendTo(slot);
            const swaps = { c: 0, s: 0, t: 0 };
            for (let i = 0; i < path.length; i++) {
                const lastState = path[i - 1] || initial;
                const lastNode = graph[lastState];
                if (!lastNode)
                    throw new Error('Last node is not in the graph??????');
                const currentState = path[i];
                const swap = lastNode.connections.get(currentState);
                if (!swap)
                    throw new Error('No connection between these two nodes?????????');
                const swapUI = (0, kitsui_6.Component)()
                    .style('path-swap')
                    .append((0, kitsui_6.Component)()
                    .style('path-swap-number')
                    .style.bind(displayMode.equals('icons'), 'path-swap-number--icons')
                    .text.set(`${i + 1}`))
                    .appendTo(wrapper);
                const swapInstructions = (0, kitsui_6.Component)()
                    .style('path-swap-instructions')
                    .style.bindFrom(displayMode.map(slot, mode => `path-swap-instructions--${mode}`))
                    .appendTo(swapUI);
                const swapComponents = swap.components.split('');
                // ensure that when swap components are broken up between two rounds, the last round one goes first
                swapComponents.sort((a, b) => swaps[a] - swaps[b]);
                let selectShape;
                let selectPos;
                for (let j = 0; j < swapComponents.length; j++) {
                    const hadSwapsOfThisType = swaps[swapComponents[j]]++;
                    if (hadSwapsOfThisType) {
                        (0, kitsui_6.Component)()
                            .style('path-swap-instructions-step', 'path-swap-instructions-step--side')
                            .text.set(quilt => quilt['card/outside-goal/path/ogres']())
                            .appendToWhen(displayMode.notEquals('icons'), swapInstructions);
                        swaps.c = 0;
                        swaps.s = 0;
                        swaps.t = 0;
                    }
                    const stepGroup = (0, kitsui_6.Component)()
                        .style('path-swap-instructions-step-group')
                        .appendTo(swapInstructions);
                    const swapLetter = swapComponents[j];
                    const shape = shadowCalloutMap[swapLetter];
                    (0, kitsui_6.Component)()
                        .style('path-swap-instructions-step')
                        .text.set(quilt => quilt[`card/outside-goal/path/full/${shape}`]())
                        .appendToWhen(displayMode.equals('full'), stepGroup);
                    const position = swap.positions[swapLetter];
                    const positionString = statuePositions[position];
                    if (!positionString)
                        throw new Error('No position for swap component?????');
                    if (j === 0) {
                        // dissect select
                        selectShape = shape;
                        selectPos = positionString;
                        (0, kitsui_6.Component)()
                            .style('path-swap-instructions-step')
                            .text.set(quilt => quilt['card/outside-goal/path/full/dissect-select'](quilt[`card/outside-goal/path/${positionString}`]()))
                            .appendToWhen(displayMode.equals('full'), stepGroup);
                        (0, kitsui_6.Component)()
                            .style('path-swap-instructions-step')
                            .text.set(quilt => quilt['card/outside-goal/path/compact/dissect'](quilt[`card/outside-goal/path/${shape}`](), quilt[`card/outside-goal/path/${positionString}`]()))
                            .appendToWhen(displayMode.equals('compact'), stepGroup);
                        continue;
                    }
                    const lastShapeLeft = callout3DMap[lastState.slice(0, 2)];
                    const lastShapeMiddle = callout3DMap[lastState.slice(2, 4)];
                    const lastShapeRight = callout3DMap[lastState.slice(4, 6)];
                    const newShape = callout3DMap[currentState.slice(position * 2, position * 2 + 2)];
                    // dissect complete
                    (0, kitsui_6.Component)()
                        .style('path-swap-instructions-step')
                        .text.set(quilt => quilt['card/outside-goal/path/full/dissect-complete'](quilt[`card/outside-goal/path/${positionString}`]()))
                        .appendToWhen(displayMode.equals('full'), stepGroup);
                    (0, kitsui_6.Component)()
                        .style('path-swap-instructions-step')
                        .text.set(quilt => quilt['card/outside-goal/path/compact/dissect'](quilt[`card/outside-goal/path/${shape}`](), quilt[`card/outside-goal/path/${positionString}`]()))
                        .appendToWhen(displayMode.equals('compact'), stepGroup);
                    (0, kitsui_6.Component)()
                        .style('path-swap-instructions-step')
                        .text.set(quilt => quilt['card/outside-goal/path/dissect-result'](quilt[`shape/${newShape}`](), quilt[`icon/shape/${newShape}`]()))
                        .appendToWhen(displayMode.notEquals('icons'), stepGroup);
                    (0, kitsui_6.Component)()
                        .style('path-swap-instructions-step')
                        .text.set(quilt => quilt['card/outside-goal/path/icons/dissect']({
                        CURRENT_LEFT: quilt[`icon/shape/${lastShapeLeft}`](),
                        CURRENT_MIDDLE: quilt[`icon/shape/${lastShapeMiddle}`](),
                        CURRENT_RIGHT: quilt[`icon/shape/${lastShapeRight}`](),
                        LEFT_SHAPE: quilt[`icon/shape/${selectPos === 'left' ? selectShape : positionString === 'left' ? shape : 'placeholder'}`](),
                        MIDDLE_SHAPE: quilt[`icon/shape/${selectPos === 'middle' ? selectShape : positionString === 'middle' ? shape : 'placeholder'}`](),
                        RIGHT_SHAPE: quilt[`icon/shape/${selectPos === 'right' ? selectShape : positionString === 'right' ? shape : 'placeholder'}`](),
                    }))
                        .appendToWhen(displayMode.equals('icons'), stepGroup);
                }
            }
            const endShapeLeft = callout3DMap[target.slice(0, 2)];
            const endShapeMiddle = callout3DMap[target.slice(2, 4)];
            const endShapeRight = callout3DMap[target.slice(4, 6)];
            (0, kitsui_6.Component)()
                .style('path-swap')
                .append((0, kitsui_6.Component)()
                .style('path-swap-number', 'path-swap-number--icons')
                .text.set('='))
                .append((0, kitsui_6.Component)()
                .style('path-swap-instructions', 'path-swap-instructions--icons', 'path-swap-instructions--icons-result')
                .append((0, kitsui_6.Component)()
                .style('path-swap-instructions-step-group')
                .append((0, kitsui_6.Component)()
                .style('path-swap-instructions-step')
                .text.set(quilt => quilt['card/outside-goal/path/icons/result']({
                CURRENT_LEFT: quilt[`icon/shape/${endShapeLeft}`](),
                CURRENT_MIDDLE: quilt[`icon/shape/${endShapeMiddle}`](),
                CURRENT_RIGHT: quilt[`icon/shape/${endShapeRight}`](),
            })))))
                .appendToWhen(displayMode.equals('icons'), wrapper);
            if (truthMode === 'doubled')
                (0, kitsui_6.Component)()
                    .style('path-swap-instructions-result-callout')
                    .append((0, kitsui_6.Component)()
                    .style('path-swap-instructions-result-callout-truth')
                    .append(...[...target.slice(0, 2)].map(l => (0, kitsui_6.Component)().text.set(l))))
                    .append((0, kitsui_6.Component)()
                    .style('path-swap-instructions-result-callout-truth')
                    .append(...[...target.slice(2, 4)].map(l => (0, kitsui_6.Component)().text.set(l))))
                    .append((0, kitsui_6.Component)()
                    .style('path-swap-instructions-result-callout-truth')
                    .append(...[...target.slice(4, 6)].map(l => (0, kitsui_6.Component)().text.set(l))))
                    .appendTo(wrapper);
        }))
            .appendTo(app);
        //#endregion
        ////////////////////////////////////
        return component;
    });
});
// function occurrences (string: string, substring: string): number {
// 	let occurrenceIndex = string.indexOf(substring)
// 	if (occurrenceIndex === -1)
// 		return 0
// 	let count = 0
// 	while (occurrenceIndex !== -1) {
// 		count++
// 		occurrenceIndex = string.indexOf(substring, occurrenceIndex + 1)
// 	}
// 	return count
// }
define("component/Kit", ["require", "exports", "kitsui"], function (require, exports, kitsui_7) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = styleKit;
    // declare module 'kitsui/component/Loading' {
    // 	interface LoadingExtensions {
    // 		readonly transitionFinished?: Promise<void>
    // 		skipViewTransition (): void
    // 	}
    // }
    function styleKit() {
        ////////////////////////////////////
        //#region Loading
        kitsui_7.Kit.Loading.extend(loading => {
            const spinner = loading.spinner;
            loading.spinner.append(...[1, 2, 3, 4].map(i => (0, kitsui_7.Component)().style('loading-spinner-dot', `loading-spinner-dot-${i}`)));
            const interval = setInterval(async () => {
                for (const dot of spinner.getChildren())
                    dot.style('loading-spinner-dot--no-animate');
                await new Promise(resolve => setTimeout(resolve, 10));
                for (const dot of spinner.getChildren())
                    dot.style.remove('loading-spinner-dot--no-animate');
            }, 2000);
            loading.onSet((loading, owner, state) => {
                loading.errorText.text.bind(state.error.map(owner, error => error?.message ?? (quilt => quilt['shared/errored']())));
            });
            // let trans: ViewTransition | undefined
            // loading.onLoad((loading, display) => {
            // 	const transInstance = trans = ViewTransition.perform('view', display)
            // 	Object.assign(loading, { transitionFinished: trans.finished })
            // 	void trans.finished.then(() => {
            // 		if (trans === transInstance)
            // 			trans = undefined
            // 		if (loading.transitionFinished === transInstance.finished)
            // 			Object.assign(loading, { transitionFinished: undefined })
            // 	})
            // })
            loading.onRemoveManual(() => clearInterval(interval));
            // return {
            // 	skipViewTransition () {
            // 		trans?.skipTransition()
            // 	},
            // }
            return {};
        });
        kitsui_7.Kit.Loading.styleTargets({
            Loading: 'loading',
            LoadingLoaded: 'loading--loaded',
            Spinner: 'loading-spinner',
            ProgressBar: 'loading-progress',
            ProgressBarProgressUnknown: 'loading-progress--unknown',
            MessageText: 'loading-message',
            ErrorIcon: 'loading-error-icon',
            ErrorText: 'loading-error',
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Popover
        kitsui_7.Kit.Popover.styleTargets({
            Popover: 'popover',
            PopoverCloseSurface: 'popover-close-surface',
            Popover_AnchoredTop: 'popover--anchored-top',
            Popover_AnchoredLeft: 'popover--anchored-left',
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Dialog
        kitsui_7.Kit.Dialog.styleTargets({
            Dialog: 'dialog',
            Dialog_Open: 'dialog--open',
        });
        //#endregion
        ////////////////////////////////////
        ////////////////////////////////////
        //#region Tooltip
        kitsui_7.Kit.Tooltip.extend(tooltip => {
            const main = (0, kitsui_7.Component)()
                .style('tooltip-block')
                .style.bind(tooltip.visible, 'tooltip-block--visible')
                .appendTo(tooltip);
            const content = (0, kitsui_7.Component)()
                .style('tooltip-content')
                .appendTo(main);
            const header = (0, kitsui_7.Component)()
                .style('tooltip-header')
                .appendTo(content);
            const body = (0, kitsui_7.Component)()
                .style('tooltip-body')
                .appendTo(content);
            tooltip.extendJIT('extra', () => (0, kitsui_7.Component)()
                .style('tooltip-content', 'tooltip-extra')
                .appendTo((0, kitsui_7.Component)()
                .style('tooltip-block')
                .style.bind(tooltip.visible, 'tooltip-block--visible')
                .appendTo(tooltip.style('tooltip--has-extra'))));
            return {
                content,
                header,
                body,
            };
        });
        kitsui_7.Kit.Tooltip.styleTargetsPartial({
            Tooltip: 'tooltip',
        });
        //#endregion
        ////////////////////////////////////
    }
});
define("utility/Env", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Env {
        async init() {
            const raw = await fetch('/.env').then(res => res.text());
            const acc = this;
            for (const line of raw.split('\n')) {
                if (line.startsWith('#') || !line.trim())
                    continue;
                let [key, value] = line.split('=');
                if (!key || !value)
                    throw new Error(`Invalid .env line: ${line}`);
                key = key.trim();
                value = value.trim();
                if (value.startsWith('"') && value.endsWith('"'))
                    value = value.slice(1, -1);
                acc[key] = value;
            }
        }
    }
    exports.default = new Env();
});
define("utility/Script", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Script;
    (function (Script) {
        function allowModuleRedefinition(...paths) {
            for (const path of paths)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                window.allowRedefine(path);
        }
        Script.allowModuleRedefinition = allowModuleRedefinition;
        async function reload(path) {
            document.querySelector(`script[src^="${path}"]`)?.remove();
            const script = document.createElement('script');
            script.src = `${path}?${Date.now()}`;
            return new Promise((resolve, reject) => {
                script.onload = () => resolve();
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        Script.reload = reload;
    })(Script || (Script = {}));
    exports.default = Script;
});
define("utility/Style", ["require", "exports", "kitsui/utility/StyleManipulator", "style", "utility/Script"], function (require, exports, StyleManipulator_1, style_1, Script_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    style_1 = __importDefault(style_1);
    Script_1 = __importDefault(Script_1);
    StyleManipulator_1.style.value = style_1.default;
    var Style;
    (function (Style) {
        let reloading;
        async function reload() {
            while (reloading)
                await reloading;
            await (reloading = (async () => {
                const stylesheetReloaded = reloadStylesheet(`${location.origin}/style/index.css`);
                Script_1.default.allowModuleRedefinition('style');
                await Script_1.default.reload(`${location.origin}/style/index.js`);
                StyleManipulator_1.style.value = await new Promise((resolve_1, reject_1) => { require(['style'], resolve_1, reject_1); }).then(__importStar).then(module => module.default);
                await stylesheetReloaded;
            })());
            reloading = undefined;
        }
        Style.reload = reload;
        async function reloadStylesheet(path) {
            const oldStyle = document.querySelector(`link[rel=stylesheet][href^="${path}"]`);
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.href = `${path}?${Date.now()}`;
            return new Promise((resolve, reject) => {
                style.onload = () => resolve();
                style.onerror = reject;
                document.head.appendChild(style);
            }).finally(() => oldStyle?.remove());
        }
    })(Style || (Style = {}));
    exports.default = Style;
});
define("utility/DevServer", ["require", "exports", "utility/Env", "utility/Style"], function (require, exports, Env_1, Style_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Env_1 = __importDefault(Env_1);
    Style_1 = __importDefault(Style_1);
    var DevServer;
    (function (DevServer) {
        function listen() {
            if (Env_1.default.ENVIRONMENT !== 'dev')
                return;
            const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${location.host}`;
            const socket = new WebSocket(wsUrl);
            socket.addEventListener('message', event => {
                try {
                    if (typeof event.data !== 'string')
                        throw new Error('Unsupported message data');
                    const message = JSON.parse(event.data);
                    const { type } = typeof message === 'object' && message !== null ? message : {};
                    switch (type) {
                        case 'notify:css':
                            void Style_1.default.reload();
                            break;
                    }
                }
                catch {
                    console.warn('Unsupported devserver message:', event.data);
                }
            });
        }
        DevServer.listen = listen;
    })(DevServer || (DevServer = {}));
    exports.default = DevServer;
});
define("component/core/Icon", ["require", "exports", "component/core/Image", "kitsui"], function (require, exports, Image_2, kitsui_8) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    Image_2 = __importDefault(Image_2);
    var EIcon;
    (function (EIcon) {
        EIcon[EIcon["orbicular"] = 0] = "orbicular";
        EIcon[EIcon["quadrate"] = 1] = "quadrate";
        EIcon[EIcon["trigon"] = 2] = "trigon";
        EIcon[EIcon["cuboid"] = 3] = "cuboid";
        EIcon[EIcon["spheric"] = 4] = "spheric";
        EIcon[EIcon["pyramidic"] = 5] = "pyramidic";
        EIcon[EIcon["conoid"] = 6] = "conoid";
        EIcon[EIcon["cylindric"] = 7] = "cylindric";
        EIcon[EIcon["trilateral"] = 8] = "trilateral";
        EIcon[EIcon["left"] = 9] = "left";
        EIcon[EIcon["middle"] = 10] = "middle";
        EIcon[EIcon["right"] = 11] = "right";
        EIcon[EIcon["placeholder"] = 12] = "placeholder";
    })(EIcon || (EIcon = {}));
    const Icon = Object.assign((0, kitsui_8.Component)((component, icon) => {
        return component.and(Image_2.default, `/static/image/${icon}.png`)
            .style('icon');
    }), {
        is(icon) {
            return typeof icon === 'string' && icon in EIcon;
        },
    });
    exports.default = Icon;
});
define("utility/Text", ["require", "exports", "component/core/Icon", "kitsui", "kitsui/utility/StringApplicator", "lang"], function (require, exports, Icon_1, kitsui_9, StringApplicator_1, lang_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.quilt = void 0;
    Icon_1 = __importDefault(Icon_1);
    lang_1 = __importStar(lang_1);
    exports.quilt = (0, kitsui_9.State)(lang_1.default);
    var Text;
    (function (Text) {
        function init() {
            StringApplicator_1.StringApplicatorSource.register('weave', {
                match(source) {
                    return typeof source === 'function';
                },
                toNodes(source) {
                    return renderWeave(source(exports.quilt.value));
                },
                toString(source) {
                    return source(exports.quilt.value).toString();
                },
            });
        }
        Text.init = init;
        function isWeave(weave) {
            return Object.keys(weave).includes('toString');
        }
        Text.isWeave = isWeave;
        function renderWeave(weave) {
            return weave.content.map(renderWeft);
        }
        Text.renderWeave = renderWeave;
        function toString(weave) {
            return exports.quilt.value['shared/passthrough'](weave).toString();
        }
        Text.toString = toString;
        const voidElements = new Set([
            'AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT',
            'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR',
        ]);
        function renderWeft(weft) {
            if (isPlaintextWeft(weft))
                return document.createTextNode(weft.content);
            let element = !weft.tag ? undefined : createTagElement(weft.tag, weft);
            element ??= document.createElement('span');
            if (voidElements.has(element.tagName)) {
                // :3
            }
            else if (Array.isArray(weft.content))
                element.append(...weft.content.map(renderWeft));
            else if (typeof weft.content === 'object' && weft.content) {
                if (!lang_1.WeavingArg.isRenderable(weft.content)) {
                    if (isWeave(weft.content))
                        element.append(...renderWeave(weft.content));
                    else
                        element.append(renderWeft(weft.content));
                }
                else if (kitsui_9.Component.is(weft.content))
                    element.append(weft.content.element);
                else if (weft.content instanceof Node)
                    element.append(weft.content);
                else
                    console.warn('Unrenderable weave content:', weft.content);
            }
            else {
                const value = `${weft.content ?? ''}`;
                const texts = value.split('\n');
                for (let i = 0; i < texts.length; i++) {
                    if (i > 0)
                        element.append((0, kitsui_9.Component)('br').element, (0, kitsui_9.Component)().style('break').element);
                    element.append(document.createTextNode(texts[i]));
                }
            }
            return element;
        }
        function isPlaintextWeft(weft) {
            return true
                && typeof weft.content === 'string'
                && !weft.content.includes('\n')
                && !weft.tag;
        }
        function createTagElement(tag, weft) {
            const unlowercased = tag;
            tag = tag.toLowerCase();
            if (tag === 'hidden')
                return (0, kitsui_9.Component)()
                    .style('hidden')
                    .ariaHidden()
                    .attributes.append('inert')
                    .element;
            if (tag.startsWith('link(')) {
                let href = unlowercased.slice(5, -1);
                // const link = href.startsWith('/')
                // 	? Link(href as RoutePath)
                // 	: ExternalLink(href)
                if (!href.startsWith('/') && !href.startsWith('.'))
                    href = `https://${href}`;
                return (0, kitsui_9.Component)('a')
                    .style('link')
                    .attributes.set('href', href)
                    .element;
            }
            // if (tag.startsWith('.')) {
            // 	const className = tag.slice(1)
            // 	if (className in style.value)
            // 		return Component()
            // 			.style(className as keyof typeof style.value)
            // 			.element
            // }
            if (tag === 'icon') {
                const iconName = toString(weft);
                if (!Icon_1.default.is(iconName)) {
                    console.warn('Unregistered icon', iconName);
                    return undefined;
                }
                return (0, Icon_1.default)(iconName).element;
            }
            switch (tag) {
                case 'b': return document.createElement('strong');
                case 'i': return document.createElement('em');
                case 'u': return document.createElement('u');
                case 's': return document.createElement('s');
                case 'code': return (0, kitsui_9.Component)('code').style('code').element;
                // case 'sm': return Component('small')
                // 	.style('small')
                // 	.element
            }
        }
        Text.createTagElement = createTagElement;
    })(Text || (Text = {}));
    exports.default = Text;
});
define("index", ["require", "exports", "component/App", "component/Kit", "kitsui", "kitsui/utility/ActiveListener", "kitsui/utility/FocusListener", "kitsui/utility/HoverListener", "kitsui/utility/Mouse", "kitsui/utility/Viewport", "utility/DevServer", "utility/Env", "utility/Text"], function (require, exports, App_1, Kit_1, kitsui_10, ActiveListener_1, FocusListener_2, HoverListener_1, Mouse_1, Viewport_1, DevServer_1, Env_2, Text_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = default_1;
    App_1 = __importDefault(App_1);
    Kit_1 = __importDefault(Kit_1);
    ActiveListener_1 = __importDefault(ActiveListener_1);
    FocusListener_2 = __importDefault(FocusListener_2);
    HoverListener_1 = __importDefault(HoverListener_1);
    Mouse_1 = __importDefault(Mouse_1);
    Viewport_1 = __importDefault(Viewport_1);
    DevServer_1 = __importDefault(DevServer_1);
    Env_2 = __importDefault(Env_2);
    Text_1 = __importDefault(Text_1);
    async function default_1() {
        kitsui_10.Component.allowBuilding();
        Text_1.default.init();
        kitsui_10.Component.getBody().style('body');
        await Env_2.default['init']();
        DevServer_1.default.listen();
        HoverListener_1.default.listen();
        ActiveListener_1.default.listen();
        FocusListener_2.default.listen();
        Mouse_1.default.listen();
        Viewport_1.default.listen();
        kitsui_10.Component.getBody().monitorScrollEvents();
        kitsui_10.Component.getDocument().monitorScrollEvents();
        kitsui_10.Component.getWindow().monitorScrollEvents();
        (0, Kit_1.default)();
        (0, App_1.default)().appendTo(document.body);
    }
});
