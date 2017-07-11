/*! npr-pym-lazyload-loader.js - v2.0.1 - 2017-07-11 */
/*
* npr-pym-lazyload-loader is a wrapper library that deals with particular CMS scenarios to successfully load Pym.js, carebot and child tracker in NPR.org into a given page
* To find out more about Pym.js check out the docs at http://blog.apps.npr.org/pym.js/ or the readme at README.md for usage.
*/

/** @module npr-pym-lazyload-loader */
(function(requirejs, jQuery) {
    var pymParents = [];

    /**
    * Create and dispatch a custom npr-pym-lazyload-loader event
    *
    * @method _raiseCustomEvent
    * @inner
    *
    * @param {String} eventName
    */
   var _raiseCustomEvent = function(eventName) {
     var event = document.createEvent('Event');
     event.initEvent('npr-pym-lazyload-loader:' + eventName, true, true);
     document.dispatchEvent(event);
   };

   var onNpr = function() {
        var re = /^https?:\/\/(www(-s1)?\.)?npr\.org/;
        if (window.location.href.match(re)) {
            return true;
        } else {
            return false;
        }
   };

    // PJAXNavigation
    var onPJAXNavigateMessage = function(url) {
        var anchor = document.createElement('a');
        anchor.style.display = 'none';
        anchor.setAttribute('href', url);
        document.getElementById('main-section').appendChild(anchor);
        anchor.click();
        anchor.parentNode.removeChild(anchor);
    };

    /**
    * Initialize pym instances if Pym.js itself is available
    *
    * @method initializePym
    * @instance
    *
    * @param {String} pym Pym.js loaded library.
    * @param {Boolean} doNotRaiseEvents flag to avoid sending custom events
    */
    var initializePym = function(pym, doNotRaiseEvents) {
        if(pym) {
            if (!doNotRaiseEvents) {
                _raiseCustomEvent("pym-loaded");
            }
            var containers = document.querySelectorAll('[data-pym-lazyload-loader]:not([data-embed-loaded])');
            for (var idx = 0; idx < containers.length; ++idx) {
                if (containers[idx].getAttribute('id') === null) {
                    console.error('container element does not have an id attribute');
                    continue;
                }
                if (containers[idx].getAttribute('data-child-src') === null) {
                    console.error('container element does not have a data-child-src attribute');
                    continue;
                }
                (function() {
                    var container = containers[idx];
                    var pymParent = new pym.Parent(
                        container.getAttribute('id'),
                        container.getAttribute('data-child-src'),
                        {}
                    );
                    container.setAttribute('data-embed-loaded', '');
                    if (onNpr()) {
                        pymParent.onMessage('pjax-navigate', onPJAXNavigateMessage);
                    }
                    pymParents.push(pymParent);
                })();
                window.npr_pym_lazyload_loader_loading = undefined;
            }
            return true;
        }
        return false;
    };

    // Child Tracking messages functionality
    /**
    * Sends On Screen message to the child
    *
    * @method sendOnScreen
    * @instance
    *
    * @param {String} id The id of the element in the child that has appeared on screen
    */
    var sendOnScreen = function(id) {
        // TODO: Improve hack
        // Ignore events to empty embeds, keeps listening after unloading the page
        if (this.el.getElementsByTagName('iframe').length !== 0) {
            this.sendMessage('element-read', id);
        }
    };

    /**
    * Function called from the child to test if the parent has visibility tracker
    * enabled to allow for fallback options
    *
    * @method onTestVisibilityTracker
    * @instance
    */
    var onTestVisibilityTracker = function() {
        var id = location.hash;
        // TODO: Improve hack
        // Ignore events to empty embeds, keeps listening after unloading the page
        if (this.el.getElementsByTagName('iframe').length !== 0) {
            this.sendMessage('visibility-available', id);
        }
    };

    /**
    * Function fired from the child through pym messaging in order to remove a
    * given element from the visibility tracking system and avoid memory bloating
    *
    * @method onRemoveTracker
    * @instance
    *
    * @param {String} id The id of the element in the child to remove from tracking
    */
    var onRemoveTracker = function(id) {
        this.trackers[id].stopTracking();
        delete this.trackers[id];
    };

    /**
    * Function fired from the child through pym messaging in order to add a new element
    * to the visibility tracking system
    *
    * @method onNewFactCheck
    * @instance
    *
    * @param {String} id The id of the element in the child to track
    */
    var onRequestTracking = function(local_tracker, id) {
        // Config to override default timing parameters on the visibility tracker
        //
        //    WAIT_TO_ENSURE_SCROLLING_IS_DONE: 40,
        //    WAIT_TO_MARK_READ: 500,
        //    ANIMATION_DURATION: 800
        //
        var config = {};

        if (local_tracker) {
            var t = new local_tracker.VisibilityTracker(this, id, sendOnScreen.bind(this, id), config);
            this.trackers[id] = t;
        } else {
            var tracker = new window.ChildTracker.VisibilityTracker(this, id, sendOnScreen.bind(this, id), config);
            this.trackers[id] = tracker;
        }
    };

    /**
    * Add child visibility tracking functionality
    *
    * @method initalizeTracker
    *
    * @param {Object} Child visibility tracker library in case it is not global (require.js)
    * @param {Boolean} doNotRaiseEvents flag to avoid sending custom events
    */
    var initializeTracker = function(pym, local_tracker, doNotRaiseEvents) {
        if (pym) {
            if (!doNotRaiseEvents) { _raiseCustomEvent("tracker-loaded"); }
            var instances = pymParents;
            for (var idx = 0; idx < instances.length; ++idx) {
                // Create a valid anonymous closure for CarebotTracker callbacks
                (function() {
                    var instance = instances[idx];
                    instance.trackers = {};
                    instance.onMessage('test-visibility-tracker', onTestVisibilityTracker);
                    instance.onMessage('remove-tracker', onRemoveTracker);
                    instance.onMessage('request-tracking', onRequestTracking.bind(instance, local_tracker));
                })();
            }
        }
    };

    /**
    * Initialize carebot instances if Pym.js itself is available
    *
    * @method initializeCarebot
    * @instance
    *
    * @param {Object} pym Pym.js loaded library.
    * @param {Object} carebot CarebotTracker loaded library.
    * @param {Boolean} doNotRaiseEvents flag to avoid sending custom events
    */
    var initializeCarebot = function(pym, carebot, doNotRaiseEvents) {
        if (pym && carebot) {
            if (!doNotRaiseEvents) { _raiseCustomEvent("carebot-loaded"); }
            var instances = pymParents;
            for (var idx = 0; idx < instances.length; ++idx) {
                if (instances[idx].el.getAttribute('data-carebot-skip') != null) {
                    continue;
                }

                // Create a valid anonymous closure for CarebotTracker callbacks
                (function() {
                    var instance = instances[idx];
                    new carebot.VisibilityTracker(instance.id, function(result) {
                        // Waiting for a more elegant solution synced with carebotTracker
                        if (instance.el.getElementsByTagName('iframe').length !== 0) {
                            instance.sendMessage('on-screen', result.bucket);
                        }
                    });
                    if (!doNotRaiseEvents) { _raiseCustomEvent("carebot-visibility-added"); }
                    // Check if there is already an scroll tracker somewhere on the page
                    if (!document.querySelector("[data-carebot-scroll]")) {
                        if (!doNotRaiseEvents) { _raiseCustomEvent("carebot-scroll-added"); }
                        instance.el.setAttribute("data-carebot-scroll", "");
                        new carebot.ScrollTracker('storytext', function(percent, seconds) {
                            // Waiting for a more elegant solution synced with carebotTracker
                            if (instance.el.getElementsByTagName('iframe').length !== 0) {
                                instance.sendMessage('scroll-depth', JSON.stringify({percent: percent,seconds: seconds}));
                            }
                        });
                    }
                })();
            }
        }
    };

    /**
     * Load pym with Requirejs if it is available on the page
     * Used in CorePublisher CMS member sites with persistent players
     * Create a different context to allow multiversion
     * via: http://requirejs.org/docs/api.html#multiversion
     *
     * @method tryLoadingWithRequirejs
     * @instance
     *
     * @param {String} pymUrl Url where Pym.js can be found
     */
    var tryLoadingWithRequirejs = function(pymUrl, carebotUrl, trackerUrl) {
        if (typeof requirejs !== 'undefined') {
            // Requirejs config wants bare name, not the extension
            pymUrl = pymUrl.split(".js")[0];
            trackerUrl = trackerUrl.split(".js")[0];
            var paths = {'pym': pymUrl, 'tracker': trackerUrl};
            var shim = {'pym': { 'exports': 'pym'},
                        'tracker': { 'exports': 'tracker'}};
            var libs = ['require', 'pym', 'tracker'];
            if (carebotUrl) {
                carebotUrl = carebotUrl.split(".js")[0];
                paths['carebot'] = carebotUrl;
                shim['carebot'] = { 'exports': 'carebot' };
                libs.push('carebot');
            }
            var context = 'context_lazyload_' + pymUrl.split('/').slice(-1)[0];
            // Requirejs detected, create a local require.js namespace
            var require_pym = requirejs.config({
                'context': context,
                'paths': paths,
                'shim': shim
            });

            // Load pym into local namespace
            require_pym(libs, function(require, pym, tracker, carebot) {
                initializePym(pym);
                initializeTracker(pym, tracker);
                if (carebot) {
                    initializeCarebot(pym, carebot);
                }
            });
            return true;
        }
        return false;
    };

    /**
     * Load pym through jQuery async getScript module
     * Since this loader can be embedded multiple times in the same post
     * the function manages a global flag called pymloading to avoid
     * possible race conditions
     *
     * @method tryLoadingWithJQuery
     * @instance
     *
     * @param {String} pymUrl Url where Pym.js can be found
     * @param {String} carebotUrl Url where carebot-tracker.js can be found
     */
    var tryLoadingWithJQuery = function(pymUrl, carebotUrl, trackerUrl) {
        if (typeof jQuery !== 'undefined' && typeof jQuery.getScript === 'function') {
            jQuery.getScript(pymUrl)
                .done(function() {
                    jQuery(function () {
                        initializePym(window.pym);
                        // Load childTracker
                        jQuery.getScript(trackerUrl).done(function() {
                            initializeTracker(window.pym);
                        });
                        // Load carebot when used inside npr.org
                        if (carebotUrl) {
                            jQuery.getScript(carebotUrl).done(function() {
                                initializeCarebot(window.pym, window.CarebotTracker);
                            });
                        }
                    });
                })
                .fail(function() {
                    console.error('could not load pym with jQuery');
                    window.npr_pym_lazyload_loader_loading = undefined;
                });
            return true;
        }
        return false;
    };

    /**
     * As another loading fallback approach
     * try to append the script tag to the head of the document
     * via http://stackoverflow.com/questions/6642081/jquery-getscript-methods-internal-process
     * via http://unixpapa.com/js/dyna.html
     *
     * @method loadPymViaEmbedding
     * @instance
     *
     * @param {String} pymUrl Url where Pym.js can be found
     * @param {String} carebotUrl Url where carebot-tracker.js can be found
     * @param {String} trackerUrl Url where child-tracker.js can be found
     */
    var loadPymViaEmbedding = function(pymUrl, carebotUrl, trackerUrl) {
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = pymUrl;
        script.onload = function() {
            // Remove the script tag once pym it has been loaded
            if (head && script.parentNode) {
                head.removeChild(script);
            }
            initializePym(window.pym);
            head = document.getElementsByTagName('head')[0];
            var trackerScript = document.createElement('script');
            trackerScript.type = 'text/javascript';
            trackerScript.src = trackerUrl;
            trackerScript.onload = function() {
                // Remove the script tag once pym it has been loaded
                if (head && trackerScript.parentNode) {
                    head.removeChild(trackerScript);
                }
                // Start tracking
                initializeTracker(window.pym);
                if (carebotUrl) {
                    head = document.getElementsByTagName('head')[0];
                    var carebotScript = document.createElement('script');
                    carebotScript.type = 'text/javascript';
                    carebotScript.src = carebotUrl;
                    carebotScript.onload = function() {
                        // Remove the script tag once pym it has been loaded
                        if (head && carebotScript.parentNode) {
                            head.removeChild(carebotScript);
                        }
                        // Start tracking
                        initializeCarebot(window.pym, window.CarebotTracker);
                    };
                    head.appendChild(carebotScript);
                }
            };
            head.appendChild(trackerScript);
        };
        script.onerror = function() {
            console.error('could not append pym via embedding');
            window.npr_pym_lazyload_loader_loading = undefined;
        };
        head.appendChild(script);
    };

    var pymUrl = "https://pym.nprapps.org/pym.v1.min.js";
    var carebotUrl = "https://carebot.nprapps.org/carebot-tracker.v0.min.js";
    var trackerUrl = "https://carebot.nprapps.org/child-tracker.v2.min.js";
    carebotUrl =  onNpr() ? carebotUrl : null;

    // Start load strategy
    // When the loader is added multiple times to the same page we need
    // to actually load scripts just once for better performance
    // 2. Use a flag (npr_pym_lazyload_loader_loading) to account for asynchronous loading and remove it on actual load or error
    if (!window.npr_pym_lazyload_loader_loading) {
        // Set the global loading flag
        window.npr_pym_lazyload_loader_loading = true;
        tryLoadingWithRequirejs(pymUrl, carebotUrl, trackerUrl) || tryLoadingWithJQuery(pymUrl, carebotUrl, trackerUrl) || loadPymViaEmbedding(pymUrl, carebotUrl, trackerUrl);
    }
})(window.requirejs, window.jQuery);
