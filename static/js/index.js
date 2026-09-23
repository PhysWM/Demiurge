window.HELP_IMPROVE_VIDEOJS = false;

document.addEventListener('DOMContentLoaded', function() {
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var allVideos = [];
  var visibleVideos = new Set();

  function initializeCarousels() {
    if (!window.bulmaCarousel) {
      return;
    }

    var breakpoints = [{ changePoint: 768, slidesToShow: 1, slidesToScroll: 1 }];
    var resultsOptions = {
      slidesToScroll: 1,
      slidesToShow: 3,
      breakpoints: breakpoints,
      loop: true,
      infinite: true,
      autoplay: false,
      navigation: true,
      pagination: true,
    };

    var capabilityCount = document.querySelectorAll('#capability-carousel > .item').length;
    var capabilityOptions = {
      slidesToScroll: 1,
      slidesToShow: 1,
      breakpoints: breakpoints,
      loop: false,
      infinite: capabilityCount > 1,
      autoplay: false,
      navigation: true,
      pagination: true,
    };

    try {
      var carousels = window.bulmaCarousel.attach('#results-carousel', resultsOptions)
        .concat(window.bulmaCarousel.attach('#capability-carousel', capabilityOptions));
      var resizeFrame;

      window.addEventListener('resize', function() {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(function() {
          carousels.forEach(function(carousel) {
            carousel._setDimensions();
            carousel._transitioner.init().apply(true, carousel._setHeight.bind(carousel));
          });
        });
      });
    } catch (error) {
      console.warn('Carousel enhancement unavailable:', error);
    }
  }

  function describeVideo(video, index) {
    var figure = video.closest('figure');
    var caption = figure && figure.querySelector('figcaption');
    var section = video.closest('section');
    var heading = section && section.querySelector('h2, h3, h4');
    var parts = [];

    if (heading) {
      parts.push(heading.textContent.trim());
    }
    if (caption) {
      parts.push(caption.textContent.trim());
    }

    return parts.length ? parts.join(' — ') : 'Research result video ' + (index + 1);
  }

  function prepareVideos() {
    allVideos = Array.from(document.querySelectorAll('video'));

    allVideos.forEach(function(video, index) {
      video.autoplay = false;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('aria-label', describeVideo(video, index));

      if (!video.hasAttribute('preload')) {
        video.preload = index < 3 && !saveData ? 'metadata' : 'none';
      }
      if (saveData || prefersReducedMotion) {
        video.preload = 'none';
      }
    });

    if (!('IntersectionObserver' in window)) {
      if (!saveData && !prefersReducedMotion) {
        allVideos.forEach(function(video) {
          var playRequest = video.play();
          if (playRequest) {
            playRequest.catch(function() {});
          }
        });
      }
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var video = entry.target;
        var shouldPlay = entry.isIntersecting && entry.intersectionRatio >= 0.35;

        if (shouldPlay) {
          visibleVideos.add(video);
          if (!saveData && !prefersReducedMotion && !document.hidden) {
            var playRequest = video.play();
            if (playRequest) {
              playRequest.catch(function() {});
            }
          }
        } else {
          visibleVideos.delete(video);
          if (!video.paused) {
            video.pause();
          }
        }
      });
    }, { threshold: [0, 0.12, 0.35, 0.7] });

    allVideos.forEach(function(video) {
      observer.observe(video);
    });
  }

  function createButton(label, symbol, handler) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'media-action';
    button.innerHTML = '<span aria-hidden="true">' + symbol + '</span><span>' + label + '</span>';
    button.addEventListener('click', handler);
    return button;
  }

  function enhanceMediaGroup(group, index) {
    var videos = Array.from(group.querySelectorAll('video'));
    if (videos.length < 2) {
      return;
    }

    var toolbar = document.createElement('div');
    toolbar.className = 'group-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Controls for comparison group ' + (index + 1));

    var status = document.createElement('span');
    status.className = 'video-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = videos.length + ' synchronized views';

    toolbar.appendChild(createButton('Play all', '▶', function() {
      var anchorTime = videos[0].currentTime || 0;
      videos.forEach(function(video) {
        if (Math.abs(video.currentTime - anchorTime) > 0.2) {
          video.currentTime = anchorTime;
        }
        var playRequest = video.play();
        if (playRequest) {
          playRequest.catch(function() {});
        }
      });
      status.textContent = 'Playing ' + videos.length + ' views';
    }));

    toolbar.appendChild(createButton('Pause', 'Ⅱ', function() {
      videos.forEach(function(video) {
        video.pause();
      });
      status.textContent = 'Paused';
    }));

    toolbar.appendChild(createButton('Restart', '↺', function() {
      videos.forEach(function(video) {
        video.pause();
        video.currentTime = 0;
      });
      status.textContent = 'Restarted';
    }));

    toolbar.appendChild(status);

    var shell = document.createElement('div');
    shell.className = 'media-group-shell';
    group.parentNode.insertBefore(shell, group);
    shell.appendChild(toolbar);
    shell.appendChild(group);
  }

  function initializeMediaGroups() {
    var selector = '.comparison-grid, .ablation-grid, .large-parallax-grid, .reconstruction-grid';
    Array.from(document.querySelectorAll(selector)).forEach(enhanceMediaGroup);
  }

  function initializeNavigation() {
    var links = Array.from(document.querySelectorAll('.nav-links a'));
    var targets = links.map(function(link) {
      return document.querySelector(link.getAttribute('href'));
    }).filter(Boolean);
    var detailTargets = Array.from(document.querySelectorAll('.capability-detail, .ablation-detail'));
    var observedTargets = targets.concat(detailTargets);

    function navigationIdFor(target) {
      if (target.classList.contains('capability-detail')) {
        return 'capabilities';
      }
      if (target.classList.contains('ablation-detail')) {
        return 'ablations';
      }
      return target.id;
    }

    if ('IntersectionObserver' in window) {
      var sectionObserver = new IntersectionObserver(function(entries) {
        var visible = entries.filter(function(entry) {
          return entry.isIntersecting;
        }).sort(function(a, b) {
          return b.intersectionRatio - a.intersectionRatio;
        });

        if (!visible.length) {
          return;
        }

        var activeId = navigationIdFor(visible[0].target);
        links.forEach(function(link) {
          var active = link.getAttribute('href') === '#' + activeId;
          if (active) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      }, { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.1, 0.5] });

      observedTargets.forEach(function(target) {
        sectionObserver.observe(target);
      });
    }
  }

  function initializePageChrome() {
    var progress = document.querySelector('.reading-progress span');
    var backToTop = document.querySelector('.back-to-top');
    var ticking = false;

    function updateScrollState() {
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      progress.style.width = Math.min(100, ratio * 100) + '%';
      backToTop.classList.toggle('is-visible', window.scrollY > 700);
      ticking = false;
    }

    window.addEventListener('scroll', function() {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollState);
        ticking = true;
      }
    }, { passive: true });

    backToTop.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });

    updateScrollState();
  }

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      allVideos.forEach(function(video) {
        video.pause();
      });
      return;
    }

    if (!saveData && !prefersReducedMotion) {
      visibleVideos.forEach(function(video) {
        var playRequest = video.play();
        if (playRequest) {
          playRequest.catch(function() {});
        }
      });
    }
  });

  initializeCarousels();
  prepareVideos();
  initializeMediaGroups();
  initializeNavigation();
  initializePageChrome();
});
