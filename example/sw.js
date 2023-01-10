// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for(var s, i = 1, n = arguments.length; i < n; i++){
            s = arguments[i];
            for(var p in s)if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
function lexer(str) {
    var tokens = [];
    var i = 0;
    while(i < str.length){
        var __char = str[i];
        if (__char === "*" || __char === "+" || __char === "?") {
            tokens.push({
                type: "MODIFIER",
                index: i,
                value: str[i++]
            });
            continue;
        }
        if (__char === "\\") {
            tokens.push({
                type: "ESCAPED_CHAR",
                index: i++,
                value: str[i++]
            });
            continue;
        }
        if (__char === "{") {
            tokens.push({
                type: "OPEN",
                index: i,
                value: str[i++]
            });
            continue;
        }
        if (__char === "}") {
            tokens.push({
                type: "CLOSE",
                index: i,
                value: str[i++]
            });
            continue;
        }
        if (__char === ":") {
            var name = "";
            var j = i + 1;
            while(j < str.length){
                var code = str.charCodeAt(j);
                if (code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95) {
                    name += str[j++];
                    continue;
                }
                break;
            }
            if (!name) throw new TypeError("Missing parameter name at " + i);
            tokens.push({
                type: "NAME",
                index: i,
                value: name
            });
            i = j;
            continue;
        }
        if (__char === "(") {
            var count = 1;
            var pattern = "";
            var j = i + 1;
            if (str[j] === "?") {
                throw new TypeError("Pattern cannot start with \"?\" at " + j);
            }
            while(j < str.length){
                if (str[j] === "\\") {
                    pattern += str[j++] + str[j++];
                    continue;
                }
                if (str[j] === ")") {
                    count--;
                    if (count === 0) {
                        j++;
                        break;
                    }
                } else if (str[j] === "(") {
                    count++;
                    if (str[j + 1] !== "?") {
                        throw new TypeError("Capturing groups are not allowed at " + j);
                    }
                }
                pattern += str[j++];
            }
            if (count) throw new TypeError("Unbalanced pattern at " + i);
            if (!pattern) throw new TypeError("Missing pattern at " + i);
            tokens.push({
                type: "PATTERN",
                index: i,
                value: pattern
            });
            i = j;
            continue;
        }
        tokens.push({
            type: "CHAR",
            index: i,
            value: str[i++]
        });
    }
    tokens.push({
        type: "END",
        index: i,
        value: ""
    });
    return tokens;
}
function parse(str, options) {
    if (options === void 0) {
        options = {};
    }
    var tokens = lexer(str);
    var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a;
    var defaultPattern = "[^" + escapeString(options.delimiter || "/#?") + "]+?";
    var result = [];
    var key = 0;
    var i = 0;
    var path = "";
    var tryConsume = function(type) {
        if (i < tokens.length && tokens[i].type === type) return tokens[i++].value;
    };
    var mustConsume = function(type) {
        var value = tryConsume(type);
        if (value !== undefined) return value;
        var _a = tokens[i], nextType = _a.type, index = _a.index;
        throw new TypeError("Unexpected " + nextType + " at " + index + ", expected " + type);
    };
    var consumeText = function() {
        var result = "";
        var value;
        while(value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")){
            result += value;
        }
        return result;
    };
    while(i < tokens.length){
        var __char = tryConsume("CHAR");
        var name = tryConsume("NAME");
        var pattern = tryConsume("PATTERN");
        if (name || pattern) {
            var prefix = __char || "";
            if (prefixes.indexOf(prefix) === -1) {
                path += prefix;
                prefix = "";
            }
            if (path) {
                result.push(path);
                path = "";
            }
            result.push({
                name: name || key++,
                prefix: prefix,
                suffix: "",
                pattern: pattern || defaultPattern,
                modifier: tryConsume("MODIFIER") || ""
            });
            continue;
        }
        var value = __char || tryConsume("ESCAPED_CHAR");
        if (value) {
            path += value;
            continue;
        }
        if (path) {
            result.push(path);
            path = "";
        }
        var open = tryConsume("OPEN");
        if (open) {
            var prefix = consumeText();
            var name_1 = tryConsume("NAME") || "";
            var pattern_1 = tryConsume("PATTERN") || "";
            var suffix = consumeText();
            mustConsume("CLOSE");
            result.push({
                name: name_1 || (pattern_1 ? key++ : ""),
                pattern: name_1 && !pattern_1 ? defaultPattern : pattern_1,
                prefix: prefix,
                suffix: suffix,
                modifier: tryConsume("MODIFIER") || ""
            });
            continue;
        }
        mustConsume("END");
    }
    return result;
}
function escapeString(str) {
    return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
function flags(options) {
    return options && options.sensitive ? "" : "i";
}
function regexpToRegexp(path, keys) {
    if (!keys) return path;
    var groups = path.source.match(/\((?!\?)/g);
    if (groups) {
        for(var i = 0; i < groups.length; i++){
            keys.push({
                name: i,
                prefix: "",
                suffix: "",
                modifier: "",
                pattern: ""
            });
        }
    }
    return path;
}
function arrayToRegexp(paths, keys, options) {
    var parts = paths.map(function(path) {
        return pathToRegexp(path, keys, options).source;
    });
    return new RegExp("(?:" + parts.join("|") + ")", flags(options));
}
function stringToRegexp(path, keys, options) {
    return tokensToRegexp(parse(path, options), keys, options);
}
function tokensToRegexp(tokens, keys, options) {
    if (options === void 0) {
        options = {};
    }
    var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
        return x;
    } : _d;
    var endsWith = "[" + escapeString(options.endsWith || "") + "]|$";
    var delimiter = "[" + escapeString(options.delimiter || "/#?") + "]";
    var route = start ? "^" : "";
    for(var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++){
        var token = tokens_1[_i];
        if (typeof token === "string") {
            route += escapeString(encode(token));
        } else {
            var prefix = escapeString(encode(token.prefix));
            var suffix = escapeString(encode(token.suffix));
            if (token.pattern) {
                if (keys) keys.push(token);
                if (prefix || suffix) {
                    if (token.modifier === "+" || token.modifier === "*") {
                        var mod = token.modifier === "*" ? "?" : "";
                        route += "(?:" + prefix + "((?:" + token.pattern + ")(?:" + suffix + prefix + "(?:" + token.pattern + "))*)" + suffix + ")" + mod;
                    } else {
                        route += "(?:" + prefix + "(" + token.pattern + ")" + suffix + ")" + token.modifier;
                    }
                } else {
                    route += "(" + token.pattern + ")" + token.modifier;
                }
            } else {
                route += "(?:" + prefix + suffix + ")" + token.modifier;
            }
        }
    }
    if (end) {
        if (!strict) route += delimiter + "?";
        route += !options.endsWith ? "$" : "(?=" + endsWith + ")";
    } else {
        var endToken = tokens[tokens.length - 1];
        var isEndDelimited = typeof endToken === "string" ? delimiter.indexOf(endToken[endToken.length - 1]) > -1 : endToken === undefined;
        if (!strict) {
            route += "(?:" + delimiter + "(?=" + endsWith + "))?";
        }
        if (!isEndDelimited) {
            route += "(?=" + delimiter + "|" + endsWith + ")";
        }
    }
    return new RegExp(route, flags(options));
}
function pathToRegexp(path, keys, options) {
    if (path instanceof RegExp) return regexpToRegexp(path, keys);
    if (Array.isArray(path)) return arrayToRegexp(path, keys, options);
    return stringToRegexp(path, keys, options);
}
var Router = function() {
    function Router() {
        this.routes = [];
    }
    Router.prototype.all = function(path, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this._push('ALL', path, handler, options);
    };
    Router.prototype.get = function(path, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this._push('GET', path, handler, options);
    };
    Router.prototype.post = function(path, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this._push('POST', path, handler, options);
    };
    Router.prototype.put = function(path, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this._push('PUT', path, handler, options);
    };
    Router.prototype.patch = function(path, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this._push('PATCH', path, handler, options);
    };
    Router.prototype["delete"] = function(path, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this._push('DELETE', path, handler, options);
    };
    Router.prototype.head = function(path, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this._push('HEAD', path, handler, options);
    };
    Router.prototype.options = function(path, handler, options) {
        if (options === void 0) {
            options = {};
        }
        return this._push('OPTIONS', path, handler, options);
    };
    Router.prototype.match = function(method, path) {
        for(var _i = 0, _a = this.routes; _i < _a.length; _i++){
            var route = _a[_i];
            if (route.method !== method && route.method !== 'ALL') continue;
            if (route.path === '(.*)') {
                return __assign(__assign({}, route), {
                    params: {
                        '0': route.path
                    }
                });
            }
            if (route.path === '/' && route.options.end === false) {
                return __assign(__assign({}, route), {
                    params: {}
                });
            }
            var matches = route.regexp.exec(path);
            if (!matches || !matches.length) continue;
            return __assign(__assign({}, route), {
                matches: matches,
                params: keysToParams(matches, route.keys)
            });
        }
        return null;
    };
    Router.prototype._push = function(method, path, handler, options) {
        var keys = [];
        if (path === '*') {
            path = '(.*)';
        }
        var regexp = pathToRegexp(path, keys, options);
        this.routes.push({
            method: method,
            path: path,
            handler: handler,
            keys: keys,
            options: options,
            regexp: regexp
        });
        return this;
    };
    return Router;
}();
var keysToParams = function(matches, keys) {
    var params = {};
    for(var i = 1; i < matches.length; i++){
        var key = keys[i - 1];
        var prop = key.name;
        var val = matches[i];
        if (val !== undefined) {
            params[prop] = val;
        }
    }
    return params;
};
class HttpError extends Error {
    constructor(status, message){
        super(message);
        this.status = status;
    }
    status;
}
var Status;
(function(Status) {
    Status[Status["OK"] = 200] = "OK";
    Status[Status["Created"] = 201] = "Created";
    Status[Status["Accepted"] = 202] = "Accepted";
    Status[Status["NoContent"] = 204] = "NoContent";
    Status[Status["MovedPermanently"] = 301] = "MovedPermanently";
    Status[Status["Found"] = 302] = "Found";
    Status[Status["NotModified"] = 304] = "NotModified";
    Status[Status["BadRequest"] = 400] = "BadRequest";
    Status[Status["Unauthorized"] = 401] = "Unauthorized";
    Status[Status["Forbidden"] = 403] = "Forbidden";
    Status[Status["NotFound"] = 404] = "NotFound";
    Status[Status["MethodNotAllowed"] = 405] = "MethodNotAllowed";
    Status[Status["InternalServerError"] = 500] = "InternalServerError";
})(Status || (Status = {}));
async function rendererDefault(template, data, context) {
    const response = await fetch(template);
    const html = await response.text();
    const result = html.replace(/\${([^}]+)}/g, (_, key)=>{
        const replacement = data[key];
        return replacement.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    });
    const headers = new Headers(context.response.headers);
    if (headers.get("Content-Type") === null) {
        headers.set("Content-Type", "text/html");
    }
    const status = context.response.status ?? Status.OK;
    return new Response(result, {
        headers,
        status
    });
}
class Context {
    params;
    request;
    response = {};
    state = {};
    #renderer;
    #response;
    constructor(params, request, renderer){
        this.params = params;
        this.request = request;
        this.#renderer = renderer ?? rendererDefault;
    }
    getResponse() {
        return this.#response ?? Promise.resolve(new Response());
    }
    render(template, data = {}) {
        this.#response = this.#renderer(template, data, this);
    }
    assert(condition, status, message) {
        if (!condition) {
            throw new HttpError(status, message);
        }
    }
    throws(status, message) {
        throw new HttpError(status, message);
    }
}
class Application extends Router {
    #errorRoutes = new Map();
    #renderer;
    #logger = console;
    #appState = {};
    debug;
    info;
    warn;
    error;
    trace;
    get errorRoutes() {
        return this.#errorRoutes;
    }
    constructor(){
        super();
        const log = (method)=>(...args)=>this.#logger[method](...args);
        this.debug = log("log");
        this.info = log("info");
        this.warn = log("warn");
        this.error = log("error");
        this.trace = log("trace");
    }
    set(prop, value) {
        this.#appState[prop] = value;
    }
    setLogger(logger) {
        this.#logger = logger;
    }
    setRenderEngine(renderer) {
        this.#renderer = renderer;
    }
    handleError(status, handler) {
        this.#errorRoutes.set(status, handler);
    }
    listen(event) {
        const request = event.request;
        const { pathname  } = new URL(request.url);
        const match = this.match(request.method, pathname);
        if (match) {
            const context = new Context(match.params, request, this.#renderer);
            context.state = this.#appState;
            event.respondWith((async ()=>{
                try {
                    this.info(`DONE: ${match.method} ${match.path}`, match.params);
                    await match.handler(context);
                    return context.getResponse();
                } catch (error1) {
                    this.warn(`FAIL: ${match.method} ${match.path}`, match.params);
                    const handler = error1 instanceof HttpError ? this.errorRoutes.get(error1.status) : this.errorRoutes.get(Status.InternalServerError);
                    if (handler) {
                        context.state.error = error1;
                        try {
                            await handler(context);
                            return context.getResponse();
                        } catch (error) {
                            this.error(`Error handler failed to respond!`);
                            this.trace(error);
                            return new Response(error.message, {
                                status: Status.InternalServerError
                            });
                        }
                    }
                    return new Response(error1.message, {
                        status: error1.status
                    });
                }
            })());
        }
    }
}
function createApplication() {
    return new Application();
}
const app = createApplication();
app.get("/example/test", (context)=>{
    context.render("templates/test.html", {
        title: "Hello, world!",
        content: "This is a text."
    });
});
app.get("/example/test2", (context)=>{
    context.response.headers = new Headers({
        "Content-Type": "text/html"
    });
    context.render("templates/test.html", {
        title: "Hello, universe!",
        content: "Some other text."
    });
});
globalThis.addEventListener("fetch", (event)=>{
    app.listen(event);
});
