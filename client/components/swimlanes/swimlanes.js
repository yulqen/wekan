import { ReactiveCache } from '/imports/reactiveCache';
import dragscroll from '@wekanteam/dragscroll';
const { calculateIndex } = Utils;



function currentListIsInThisSwimlane(swimlaneId) {
  const currentList = Utils.getCurrentList();
  return (
    currentList &&
    (currentList.swimlaneId === swimlaneId || currentList.swimlaneId === '')
  );
}

function currentCardIsInThisList(listId, swimlaneId) {
  const currentCard = Utils.getCurrentCard();
  //const currentUser = ReactiveCache.getCurrentUser();
  if (
    //currentUser &&
    //currentUser.profile &&
    Utils.boardView() === 'board-view-swimlanes'
  )
    return (
      currentCard &&
      currentCard.listId === listId &&
      currentCard.swimlaneId === swimlaneId
    );
  else if (
    //currentUser &&
    //currentUser.profile &&
    Utils.boardView() === 'board-view-lists'
  )
    return (
      currentCard &&
      currentCard.listId === listId
    );

  // https://github.com/wekan/wekan/issues/1623
  // https://github.com/ChronikEwok/wekan/commit/cad9b20451bb6149bfb527a99b5001873b06c3de
  // TODO: In public board, if you would like to switch between List/Swimlane view, you could
  //       1) If there is no view cookie, save to cookie board-view-lists
  //          board-view-lists / board-view-swimlanes / board-view-cal
  //       2) If public user changes clicks board-view-lists then change view and
  //          then change view and save cookie with view value
  //          without using currentuser above, because currentuser is null.
}

function initSortable(boardComponent, $listsDom) {
  // Safety check: ensure we have valid DOM elements
  if (!$listsDom || $listsDom.length === 0) {
    console.error('initSortable: No valid DOM elements provided');
    return;
  }
  
  // Check if sortable is already initialized
  if ($listsDom.data('uiSortable') || $listsDom.data('sortable')) {
    $listsDom.sortable('destroy');
  }
  
  
  // We want to animate the card details window closing. We rely on CSS
  // transition for the actual animation.
  $listsDom._uihooks = {
    removeElement(node) {
      const removeNode = _.once(() => {
        node.parentNode.removeChild(node);
      });
      if ($(node).hasClass('js-card-details')) {
        $(node).css({
          flexBasis: 0,
          padding: 0,
        });
        $listsDom.one(CSSEvents.transitionend, removeNode);
      } else {
        removeNode();
      }
    },
  };

  
  // Add click debugging for drag handles
  $listsDom.on('mousedown', '.js-list-handle', function(e) {
    e.stopPropagation();
  });
  
  $listsDom.on('mousedown', '.js-list-header', function(e) {
  });
  
  // Add debugging for any mousedown on lists
  $listsDom.on('mousedown', '.js-list', function(e) {
  });
  
  // Add debugging for sortable events
  $listsDom.on('sortstart', function(e, ui) {
  });
  
  $listsDom.on('sortbeforestop', function(e, ui) {
  });
  
  $listsDom.on('sortstop', function(e, ui) {
  });
  
  try {
    $listsDom.sortable({
      connectWith: '.js-swimlane, .js-lists',
      tolerance: 'pointer',
      appendTo: '.board-canvas',
      helper(evt, item) {
        const helper = item.clone();
        helper.css('z-index', 1000);
        return helper;
      },
      items: '.js-list:not(.js-list-composer)',
      placeholder: 'list placeholder',
      distance: 3,
      forcePlaceholderSize: true,
      cursor: 'move',
    start(evt, ui) {
      ui.helper.css('z-index', 1000);
      ui.placeholder.height(ui.helper.height());
      ui.placeholder.width(ui.helper.width());
      EscapeActions.executeUpTo('popup-close');
      boardComponent.setIsDragging(true);
      
      // Add visual feedback for list being dragged
      ui.item.addClass('ui-sortable-helper');
      
      // Disable dragscroll during list dragging to prevent interference
      try {
        dragscroll.reset();
      } catch (e) {
      }
      
      // Also disable dragscroll on all swimlanes during list dragging
      $('.js-swimlane').each(function() {
        $(this).removeClass('dragscroll');
      });
    },
    beforeStop(evt, ui) {
      // Clean up visual feedback
      ui.item.removeClass('ui-sortable-helper');
    },
    stop(evt, ui) {
      // To attribute the new index number, we need to get the DOM element
      // of the previous and the following card -- if any.
      const prevListDom = ui.item.prev('.js-list').get(0);
      const nextListDom = ui.item.next('.js-list').get(0);
      const sortIndex = calculateIndex(prevListDom, nextListDom, 1);

      const listDomElement = ui.item.get(0);
      if (!listDomElement) {
        console.error('List DOM element not found during drag stop');
        return;
      }
      
      let list;
      try {
        list = Blaze.getData(listDomElement);
      } catch (error) {
        console.error('Error getting list data:', error);
        return;
      }
      
      if (!list) {
        console.error('List data not found for element:', listDomElement);
        return;
      }

      // Detect if the list was dropped in a different swimlane
      const targetSwimlaneDom = ui.item.closest('.js-swimlane');
      let targetSwimlaneId = null;


      if (targetSwimlaneDom.length > 0) {
        // List was dropped in a swimlane
        try {
          targetSwimlaneId = targetSwimlaneDom.attr('id').replace('swimlane-', '');
        } catch (error) {
          console.error('Error getting target swimlane ID:', error);
          return;
        }
      } else {
        // List was dropped in lists view (not swimlanes view)
        // In this case, assign to the default swimlane
        const currentBoard = ReactiveCache.getBoard(Session.get('currentBoard'));
        if (currentBoard) {
          const defaultSwimlane = currentBoard.getDefaultSwimline();
          if (defaultSwimlane) {
            targetSwimlaneId = defaultSwimlane._id;
          }
        }
      }

      // Get the original swimlane ID of the list (handle backward compatibility)
      const originalSwimlaneId = list.getEffectiveSwimlaneId ? list.getEffectiveSwimlaneId() : (list.swimlaneId || null);

      /*
            Reverted incomplete change list width,
            removed from below Lists.update:
             https://github.com/wekan/wekan/issues/4558
                $set: {
                  width: list._id.width(),
                  height: list._id.height(),
      */

      // Prepare update object
      const updateData = {
        sort: sortIndex.base,
      };

      // Check if the list was dropped in a different swimlane
      const isDifferentSwimlane = targetSwimlaneId && targetSwimlaneId !== originalSwimlaneId;

      // If the list was dropped in a different swimlane, update the swimlaneId
      if (isDifferentSwimlane) {
        updateData.swimlaneId = targetSwimlaneId;

        // Move all cards in the list to the new swimlane
        const cardsInList = ReactiveCache.getCards({
          listId: list._id,
          archived: false
        });

        cardsInList.forEach(card => {
          card.move(list.boardId, targetSwimlaneId, list._id);
        });


        // Don't cancel the sortable when moving to a different swimlane
        // The DOM move should be allowed to complete
      }
      // Allow reordering within the same swimlane by not canceling the sortable

      try {
        Lists.update(list._id, {
          $set: updateData,
        });
      } catch (error) {
        console.error('Error updating list:', error);
        return;
      }

      boardComponent.setIsDragging(false);
      
      // Re-enable dragscroll after list dragging is complete
      try {
        dragscroll.reset();
      } catch (e) {
      }
      
      // Re-enable dragscroll on all swimlanes
      $('.js-swimlane').each(function() {
        $(this).addClass('dragscroll');
      });
    },
  });
  } catch (error) {
    console.error('Error initializing list sortable:', error);
    return;
  }
  
  
  // Check if drag handles exist
  const dragHandles = $listsDom.find('.js-list-handle');
  
  // Check if lists exist
  const lists = $listsDom.find('.js-list');

  // Skip the complex autorun and options for now
}

BlazeComponent.extendComponent({
  onRendered() {
    const boardComponent = this.parentComponent();
    const $listsDom = this.$('.js-lists');
    

    if (!Utils.getCurrentCardId()) {
      boardComponent.scrollLeft();
    }

    // Try a simpler approach - initialize sortable directly like cards do
    
    // Wait for DOM to be ready
    setTimeout(() => {
      const $lists = this.$('.js-list');
      
      const $parent = $lists.parent();
      
      if ($lists.length > 0) {
        
        // Check for drag handles
        const $handles = $parent.find('.js-list-handle');
        
        // Test if drag handles are clickable
        $handles.on('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
        });
        
        $parent.sortable({
          connectWith: '.js-swimlane, .js-lists',
          tolerance: 'pointer',
          appendTo: '.board-canvas',
          helper: 'clone',
          items: '.js-list:not(.js-list-composer)',
          placeholder: 'list placeholder',
          distance: 7,
          handle: '.js-list-handle',
          disabled: !Utils.canModifyBoard(),
          start(evt, ui) {
            ui.helper.css('z-index', 1000);
            ui.placeholder.height(ui.helper.height());
            ui.placeholder.width(ui.helper.width());
            EscapeActions.executeUpTo('popup-close');
            boardComponent.setIsDragging(true);
          },
          stop(evt, ui) {
            boardComponent.setIsDragging(false);
          }
        });
      } else {
      }
    }, 100);
  },
  onCreated() {
    this.draggingActive = new ReactiveVar(false);

    this._isDragging = false;
    this._lastDragPositionX = 0;
  },
  id() {
    return this._id;
  },
  currentCardIsInThisList(listId, swimlaneId) {
    return currentCardIsInThisList(listId, swimlaneId);
  },
  currentListIsInThisSwimlane(swimlaneId) {
    return currentListIsInThisSwimlane(swimlaneId);
  },
  visible(list) {
    if (list.archived) {
      // Show archived list only when filter archive is on
      if (!Filter.archive.isSelected()) {
        return false;
      }
    }
    if (Filter.lists._isActive()) {
      if (!list.title.match(Filter.lists.getRegexSelector())) {
        return false;
      }
    }
    if (Filter.hideEmpty.isSelected()) {
      // Check for cards in all swimlanes, not just the current one
      // This ensures lists with cards in other swimlanes are still visible
      const cards = list.cards();
      if (cards.length === 0) {
        return false;
      }
    }
    return true;
  },
  events() {
    return [
      {
        // Click-and-drag action
        'mousedown .board-canvas'(evt) {
          // Translating the board canvas using the click-and-drag action can
          // conflict with the build-in browser mechanism to select text. We
          // define a list of elements in which we disable the dragging because
          // the user will legitimately expect to be able to select some text with
          // his mouse.

          const noDragInside = ['a', 'input', 'textarea', 'p'].concat(
            Utils.isTouchScreenOrShowDesktopDragHandles()
              ? ['.js-list-handle', '.js-swimlane-header-handle']
              : ['.js-list-header'],
          ).concat([
            '.js-list-resize-handle',
            '.js-swimlane-resize-handle'
          ]);

          const isResizeHandle = $(evt.target).closest('.js-list-resize-handle, .js-swimlane-resize-handle').length > 0;
          const isInNoDragArea = $(evt.target).closest(noDragInside.join(',')).length > 0;
          
          if (isResizeHandle) {
            return;
          }
          
          if (
            !isInNoDragArea &&
            this.$('.swimlane').prop('clientHeight') > evt.offsetY
          ) {
            this._isDragging = true;
            this._lastDragPositionX = evt.clientX;
          }
        },
        mouseup() {
          if (this._isDragging) {
            this._isDragging = false;
          }
        },
        mousemove(evt) {
          if (this._isDragging) {
            // Update the canvas position
            this.listsDom.scrollLeft -= evt.clientX - this._lastDragPositionX;
            this._lastDragPositionX = evt.clientX;
            // Disable browser text selection while dragging
            evt.stopPropagation();
            evt.preventDefault();
            // Don't close opened card or inlined form at the end of the
            // click-and-drag.
            EscapeActions.executeUpTo('popup-close');
            EscapeActions.preventNextClick();
          }
        },
      },
    ];
  },

  swimlaneHeight() {
    const user = ReactiveCache.getCurrentUser();
    const swimlane = Template.currentData();
    
    let height;
    if (user) {
      // For logged-in users, get from user profile
      height = user.getSwimlaneHeightFromStorage(swimlane.boardId, swimlane._id);
    } else {
      // For non-logged-in users, get from localStorage
      try {
        const stored = localStorage.getItem('wekan-swimlane-heights');
        if (stored) {
          const heights = JSON.parse(stored);
          if (heights[swimlane.boardId] && heights[swimlane.boardId][swimlane._id]) {
            height = heights[swimlane.boardId][swimlane._id];
          } else {
            height = -1;
          }
        } else {
          height = -1;
        }
      } catch (e) {
        console.warn('Error reading swimlane height from localStorage:', e);
        height = -1;
      }
    }
    
    return height == -1 ? "auto" : (height + 5 + "px");
  },

  onRendered() {
    // Initialize swimlane resize functionality immediately
    this.initializeSwimlaneResize();
  },

  initializeSwimlaneResize() {
    // Check if we're still in a valid template context
    if (!Template.currentData()) {
      console.warn('No current template data available for swimlane resize initialization');
      return;
    }
    
    const swimlane = Template.currentData();
    const $swimlane = $(`#swimlane-${swimlane._id}`);
    const $resizeHandle = $swimlane.find('.js-swimlane-resize-handle');
    
    // Check if elements exist
    if (!$swimlane.length || !$resizeHandle.length) {
      console.warn('Swimlane or resize handle not found, retrying in 100ms');
      Meteor.setTimeout(() => {
        if (!this.isDestroyed) {
          this.initializeSwimlaneResize();
        }
      }, 100);
      return;
    }
    
    
    if ($resizeHandle.length === 0) {
      return;
    }

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    const minHeight = 100;
    const maxHeight = 2000;

    const startResize = (e) => {
      isResizing = true;
      startY = e.pageY || e.originalEvent.touches[0].pageY;
      startHeight = parseInt($swimlane.css('height')) || 300;
      
      
      $swimlane.addClass('swimlane-resizing');
      $('body').addClass('swimlane-resizing-active');
      $('body').css('user-select', 'none');
      
      
      e.preventDefault();
      e.stopPropagation();
    };

    const doResize = (e) => {
      if (!isResizing) {
        return;
      }
      
      const currentY = e.pageY || e.originalEvent.touches[0].pageY;
      const deltaY = currentY - startY;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
      
      
      // Apply the new height immediately for real-time feedback
      $swimlane[0].style.setProperty('--swimlane-height', `${newHeight}px`);
      $swimlane[0].style.setProperty('height', `${newHeight}px`);
      $swimlane[0].style.setProperty('min-height', `${newHeight}px`);
      $swimlane[0].style.setProperty('max-height', `${newHeight}px`);
      $swimlane[0].style.setProperty('flex', 'none');
      $swimlane[0].style.setProperty('flex-basis', 'auto');
      $swimlane[0].style.setProperty('flex-grow', '0');
      $swimlane[0].style.setProperty('flex-shrink', '0');
      
      
      e.preventDefault();
      e.stopPropagation();
    };

    const stopResize = (e) => {
      if (!isResizing) return;
      
      isResizing = false;
      
      // Calculate final height
      const currentY = e.pageY || e.originalEvent.touches[0].pageY;
      const deltaY = currentY - startY;
      const finalHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
      
      // Ensure the final height is applied
      $swimlane[0].style.setProperty('--swimlane-height', `${finalHeight}px`);
      $swimlane[0].style.setProperty('height', `${finalHeight}px`);
      $swimlane[0].style.setProperty('min-height', `${finalHeight}px`);
      $swimlane[0].style.setProperty('max-height', `${finalHeight}px`);
      $swimlane[0].style.setProperty('flex', 'none');
      $swimlane[0].style.setProperty('flex-basis', 'auto');
      $swimlane[0].style.setProperty('flex-grow', '0');
      $swimlane[0].style.setProperty('flex-shrink', '0');
      
      // Remove visual feedback but keep the height
      $swimlane.removeClass('swimlane-resizing');
      $('body').removeClass('swimlane-resizing-active');
      $('body').css('user-select', '');
      
      // Save the new height using the existing system
      const boardId = swimlane.boardId;
      const swimlaneId = swimlane._id;
      
      if (process.env.DEBUG === 'true') {
      }
      
      const currentUser = ReactiveCache.getCurrentUser();
      if (currentUser) {
        // For logged-in users, use server method
        Meteor.call('applySwimlaneHeightToStorage', boardId, swimlaneId, finalHeight, (error, result) => {
          if (error) {
            console.error('Error saving swimlane height:', error);
          } else {
            if (process.env.DEBUG === 'true') {
            }
          }
        });
      } else {
        // For non-logged-in users, save to localStorage directly
        try {
          const stored = localStorage.getItem('wekan-swimlane-heights');
          let heights = stored ? JSON.parse(stored) : {};
          
          if (!heights[boardId]) {
            heights[boardId] = {};
          }
          heights[boardId][swimlaneId] = finalHeight;
          
          localStorage.setItem('wekan-swimlane-heights', JSON.stringify(heights));
          
          if (process.env.DEBUG === 'true') {
          }
        } catch (e) {
          console.warn('Error saving swimlane height to localStorage:', e);
        }
      }
      
      e.preventDefault();
    };

    // Mouse events
    $resizeHandle.on('mousedown', startResize);
    $(document).on('mousemove', doResize);
    $(document).on('mouseup', stopResize);
    
    // Touch events for mobile
    $resizeHandle.on('touchstart', startResize, { passive: false });
    $(document).on('touchmove', doResize, { passive: false });
    $(document).on('touchend', stopResize, { passive: false });
    
    
    // Prevent dragscroll interference
    $resizeHandle.on('mousedown', (e) => {
      e.stopPropagation();
    });
    
  },
}).register('swimlane');


BlazeComponent.extendComponent({
  onCreated() {
    this.currentBoard = Utils.getCurrentBoard();
    this.isListTemplatesSwimlane =
      this.currentBoard.isTemplatesBoard() &&
      this.currentData().isListTemplatesSwimlane();
    this.currentSwimlane = this.currentData();
  },

  // Proxy
  open() {
    this.childComponents('inlinedForm')[0].open();
  },

  events() {
    return [
      {
        submit(evt) {
            evt.preventDefault();

            const titleInput = this.find('.list-name-input');
            const title = titleInput?.value.trim();

            if (!title) return;

            let sortIndex = 0;
            const lastList = this.currentBoard.getLastList();
            const boardId = Utils.getCurrentBoardId();

            const positionInput = this.find('.list-position-input');

            if (positionInput) {
              const positionId = positionInput.value.trim();
              const selectedList = ReactiveCache.getList({ boardId, _id: positionId, archived: false });

              if (selectedList) {
                sortIndex = selectedList.sort + 1;
              } else {
                sortIndex = Utils.calculateIndexData(lastList, null).base;
              }
            } else {
              sortIndex = Utils.calculateIndexData(lastList, null).base;
            }

            Lists.insert({
              title,
              boardId: Session.get('currentBoard'),
              sort: sortIndex,
              type: this.isListTemplatesSwimlane ? 'template-list' : 'list',
              swimlaneId: this.currentSwimlane._id, // Always set swimlaneId for per-swimlane list titles
            });

            titleInput.value = '';
            titleInput.focus();
        }
      },
      {
        'click .js-list-template': Popup.open('searchElement'),
      },
    ];
  },
}).register('addListForm');

Template.swimlane.helpers({
  canSeeAddList() {
    return ReactiveCache.getCurrentUser().isBoardAdmin();
  },
  
  lists() {
    // Return per-swimlane lists for this swimlane
    return this.myLists();
  }
});

// Initialize sortable on DOM elements
setTimeout(() => {
  const $swimlaneElements = $('.swimlane');
  const $listsGroupElements = $('.list-group');
  
  // Initialize sortable on ALL swimlane elements (even empty ones)
  $swimlaneElements.each(function(index) {
    const $swimlane = $(this);
    const $lists = $swimlane.find('.js-list');
    
    // Only initialize on swimlanes that have the .js-lists class (the container for lists)
    if ($swimlane.hasClass('js-lists')) {
      $swimlane.sortable({
        connectWith: '.js-swimlane, .js-lists',
        tolerance: 'pointer',
        appendTo: '.board-canvas',
        helper: 'clone',
        items: '.js-list:not(.js-list-composer)',
        placeholder: 'list placeholder',
        distance: 7,
        handle: '.js-list-handle',
        disabled: !Utils.canModifyBoard(),
        start(evt, ui) {
          ui.helper.css('z-index', 1000);
          ui.placeholder.height(ui.helper.height());
          ui.placeholder.width(ui.helper.width());
          EscapeActions.executeUpTo('popup-close');
          // Try to get board component
          try {
            const boardComponent = BlazeComponent.getComponentForElement(ui.item[0]);
            if (boardComponent && boardComponent.setIsDragging) {
              boardComponent.setIsDragging(true);
            }
          } catch (e) {
            // Silent fail
          }
        },
        stop(evt, ui) {
          // To attribute the new index number, we need to get the DOM element
          // of the previous and the following list -- if any.
          const prevListDom = ui.item.prev('.js-list').get(0);
          const nextListDom = ui.item.next('.js-list').get(0);
          const sortIndex = calculateIndex(prevListDom, nextListDom, 1);

          const listDomElement = ui.item.get(0);
          if (!listDomElement) {
            return;
          }
          
          let list;
          try {
            list = Blaze.getData(listDomElement);
          } catch (error) {
            return;
          }
          
          if (!list) {
            return;
          }

          // Detect if the list was dropped in a different swimlane
          const targetSwimlaneDom = ui.item.closest('.js-swimlane');
          let targetSwimlaneId = null;

          if (targetSwimlaneDom.length > 0) {
            // List was dropped in a swimlane
            try {
              targetSwimlaneId = targetSwimlaneDom.attr('id').replace('swimlane-', '');
            } catch (error) {
              return;
            }
          } else {
            // List was dropped in lists view (not swimlanes view)
            // In this case, assign to the default swimlane
            const currentBoard = ReactiveCache.getBoard(Session.get('currentBoard'));
            if (currentBoard) {
              const defaultSwimlane = currentBoard.getDefaultSwimline();
              if (defaultSwimlane) {
                targetSwimlaneId = defaultSwimlane._id;
              }
            }
          }

          // Get the original swimlane ID of the list (handle backward compatibility)
          const originalSwimlaneId = list.getEffectiveSwimlaneId ? list.getEffectiveSwimlaneId() : (list.swimlaneId || null);

          // Prepare update object
          const updateData = {
            sort: sortIndex.base,
          };

          // Check if the list was dropped in a different swimlane
          const isDifferentSwimlane = targetSwimlaneId && targetSwimlaneId !== originalSwimlaneId;

          // If the list was dropped in a different swimlane, update the swimlaneId
          if (isDifferentSwimlane) {
            updateData.swimlaneId = targetSwimlaneId;

            // Move all cards in the list to the new swimlane
            const cardsInList = ReactiveCache.getCards({
              listId: list._id,
              archived: false
            });

            cardsInList.forEach(card => {
              card.move(list.boardId, targetSwimlaneId, list._id);
            });

            // Don't cancel the sortable when moving to a different swimlane
            // The DOM move should be allowed to complete
          }
          // Allow reordering within the same swimlane by not canceling the sortable

          try {
            Lists.update(list._id, {
              $set: updateData,
            });
          } catch (error) {
            return;
          }

          // Try to get board component
          try {
            const boardComponent = BlazeComponent.getComponentForElement(ui.item[0]);
            if (boardComponent && boardComponent.setIsDragging) {
              boardComponent.setIsDragging(false);
            }
          } catch (e) {
            // Silent fail
          }
          
          // Re-enable dragscroll after list dragging is complete
          try {
            dragscroll.reset();
          } catch (e) {
            // Silent fail
          }
          
          // Re-enable dragscroll on all swimlanes
          $('.js-swimlane').each(function() {
            $(this).addClass('dragscroll');
          });
        }
      });
    }
  });
  
  // Initialize sortable on ALL listsGroup elements (even empty ones)
  $listsGroupElements.each(function(index) {
    const $listsGroup = $(this);
    const $lists = $listsGroup.find('.js-list');
    
    // Only initialize on listsGroup elements that have the .js-lists class
    if ($listsGroup.hasClass('js-lists')) {
      $listsGroup.sortable({
        connectWith: '.js-swimlane, .js-lists',
        tolerance: 'pointer',
        appendTo: '.board-canvas',
        helper: 'clone',
        items: '.js-list:not(.js-list-composer)',
        placeholder: 'list placeholder',
        distance: 7,
        handle: '.js-list-handle',
        disabled: !Utils.canModifyBoard(),
        start(evt, ui) {
          ui.helper.css('z-index', 1000);
          ui.placeholder.height(ui.helper.height());
          ui.placeholder.width(ui.helper.width());
          EscapeActions.executeUpTo('popup-close');
          // Try to get board component
          try {
            const boardComponent = BlazeComponent.getComponentForElement(ui.item[0]);
            if (boardComponent && boardComponent.setIsDragging) {
              boardComponent.setIsDragging(true);
            }
          } catch (e) {
            // Silent fail
          }
        },
        stop(evt, ui) {
          // To attribute the new index number, we need to get the DOM element
          // of the previous and the following list -- if any.
          const prevListDom = ui.item.prev('.js-list').get(0);
          const nextListDom = ui.item.next('.js-list').get(0);
          const sortIndex = calculateIndex(prevListDom, nextListDom, 1);

          const listDomElement = ui.item.get(0);
          if (!listDomElement) {
            return;
          }
          
          let list;
          try {
            list = Blaze.getData(listDomElement);
          } catch (error) {
            return;
          }
          
          if (!list) {
            return;
          }

          // Detect if the list was dropped in a different swimlane
          const targetSwimlaneDom = ui.item.closest('.js-swimlane');
          let targetSwimlaneId = null;

          if (targetSwimlaneDom.length > 0) {
            // List was dropped in a swimlane
            try {
              targetSwimlaneId = targetSwimlaneDom.attr('id').replace('swimlane-', '');
            } catch (error) {
              return;
            }
          } else {
            // List was dropped in lists view (not swimlanes view)
            // In this case, assign to the default swimlane
            const currentBoard = ReactiveCache.getBoard(Session.get('currentBoard'));
            if (currentBoard) {
              const defaultSwimlane = currentBoard.getDefaultSwimline();
              if (defaultSwimlane) {
                targetSwimlaneId = defaultSwimlane._id;
              }
            }
          }

          // Get the original swimlane ID of the list (handle backward compatibility)
          const originalSwimlaneId = list.getEffectiveSwimlaneId ? list.getEffectiveSwimlaneId() : (list.swimlaneId || null);

          // Prepare update object
          const updateData = {
            sort: sortIndex.base,
          };

          // Check if the list was dropped in a different swimlane
          const isDifferentSwimlane = targetSwimlaneId && targetSwimlaneId !== originalSwimlaneId;

          // If the list was dropped in a different swimlane, update the swimlaneId
          if (isDifferentSwimlane) {
            updateData.swimlaneId = targetSwimlaneId;

            // Move all cards in the list to the new swimlane
            const cardsInList = ReactiveCache.getCards({
              listId: list._id,
              archived: false
            });

            cardsInList.forEach(card => {
              card.move(list.boardId, targetSwimlaneId, list._id);
            });

            // Don't cancel the sortable when moving to a different swimlane
            // The DOM move should be allowed to complete
          }
          // Allow reordering within the same swimlane by not canceling the sortable

          try {
            Lists.update(list._id, {
              $set: updateData,
            });
          } catch (error) {
            return;
          }

          // Try to get board component
          try {
            const boardComponent = BlazeComponent.getComponentForElement(ui.item[0]);
            if (boardComponent && boardComponent.setIsDragging) {
              boardComponent.setIsDragging(false);
            }
          } catch (e) {
            // Silent fail
          }
          
          // Re-enable dragscroll after list dragging is complete
          try {
            dragscroll.reset();
          } catch (e) {
            // Silent fail
          }
          
          // Re-enable dragscroll on all swimlanes
          $('.js-swimlane').each(function() {
            $(this).addClass('dragscroll');
          });
        }
      });
    }
  });
}, 1000);



BlazeComponent.extendComponent({
  currentCardIsInThisList(listId, swimlaneId) {
    return currentCardIsInThisList(listId, swimlaneId);
  },
  visible(list) {
    if (list.archived) {
      // Show archived list only when filter archive is on
      if (!Filter.archive.isSelected()) {
        return false;
      }
    }
    if (Filter.lists._isActive()) {
      if (!list.title.match(Filter.lists.getRegexSelector())) {
        return false;
      }
    }
    if (Filter.hideEmpty.isSelected()) {
      // Check for cards in all swimlanes, not just the current one
      // This ensures lists with cards in other swimlanes are still visible
      const cards = list.cards();
      if (cards.length === 0) {
        return false;
      }
    }
    return true;
  },
  onRendered() {
    const boardComponent = this.parentComponent();
    const $listsDom = this.$('.js-lists');
    

    if (!Utils.getCurrentCardId()) {
      boardComponent.scrollLeft();
    }

    // Try a simpler approach for listsGroup too
    
    // Wait for DOM to be ready
    setTimeout(() => {
      const $lists = this.$('.js-list');
      
      const $parent = $lists.parent();
      
      if ($lists.length > 0) {
        
        // Check for drag handles
        const $handles = $parent.find('.js-list-handle');
        
        // Test if drag handles are clickable
        $handles.on('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
        });
        
        $parent.sortable({
          connectWith: '.js-swimlane, .js-lists',
          tolerance: 'pointer',
          appendTo: '.board-canvas',
          helper: 'clone',
          items: '.js-list:not(.js-list-composer)',
          placeholder: 'list placeholder',
          distance: 7,
          handle: '.js-list-handle',
          disabled: !Utils.canModifyBoard(),
          start(evt, ui) {
            ui.helper.css('z-index', 1000);
            ui.placeholder.height(ui.helper.height());
            ui.placeholder.width(ui.helper.width());
            EscapeActions.executeUpTo('popup-close');
            boardComponent.setIsDragging(true);
          },
          stop(evt, ui) {
            boardComponent.setIsDragging(false);
          }
        });
      } else {
      }
    }, 100);
  },
}).register('listsGroup');


class MoveSwimlaneComponent extends BlazeComponent {
  serverMethod = 'moveSwimlane';

  onCreated() {
    this.currentSwimlane = this.currentData();
  }

  board() {
    return Utils.getCurrentBoard();
  }

  toBoardsSelector() {
    return {
      archived: false,
      'members.userId': Meteor.userId(),
      type: 'board',
      _id: { $ne: this.board()._id },
    };
  }

  toBoards() {
    const ret = ReactiveCache.getBoards(this.toBoardsSelector(), { sort: { title: 1 } });
    return ret;
  }

  events() {
    return [
      {
        'click .js-done'() {
          const bSelect = $('.js-select-boards')[0];
          let boardId;
          if (bSelect) {
            boardId = bSelect.options[bSelect.selectedIndex].value;
            Meteor.call(this.serverMethod, this.currentSwimlane._id, boardId);
          }
          Popup.back();
        },
      },
    ];
  }
}
MoveSwimlaneComponent.register('moveSwimlanePopup');

(class extends MoveSwimlaneComponent {
  serverMethod = 'copySwimlane';
  toBoardsSelector() {
    const selector = super.toBoardsSelector();
    delete selector._id;
    return selector;
  }
}.register('copySwimlanePopup'));
