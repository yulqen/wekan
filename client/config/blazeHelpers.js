import { ReactiveCache } from '/imports/reactiveCache';
import { Blaze } from 'meteor/blaze';
import { Session } from 'meteor/session';
import { 
  formatDateTime, 
  formatDate, 
  formatTime, 
  getISOWeek, 
  isValidDate, 
  isBefore, 
  isAfter, 
  isSame, 
  add, 
  subtract, 
  startOf, 
  endOf, 
  format, 
  parseDate, 
  now, 
  createDate, 
  fromNow, 
  calendar 
} from '/imports/lib/dateUtils';

Blaze.registerHelper('currentBoard', () => {
  const ret = Utils.getCurrentBoard();
  return ret;
});

Blaze.registerHelper('currentCard', () => {
  const ret = Utils.getCurrentCard();
  return ret;
});

Blaze.registerHelper('currentList', () => {
  const ret = Utils.getCurrentList();
  return ret;
});

Blaze.registerHelper('currentSetting', () => {
  const ret = ReactiveCache.getCurrentSetting();
  return ret;
});

Blaze.registerHelper('currentUser', () => {
  const ret = ReactiveCache.getCurrentUser();
  return ret;
});

Blaze.registerHelper('getUser', userId => ReactiveCache.getUser(userId));

Blaze.registerHelper('concat', (...args) => args.slice(0, -1).join(''));

Blaze.registerHelper('isMiniScreen', () => Utils.isMiniScreen());

Blaze.registerHelper('isTouchScreen', () => Utils.isTouchScreen());

Blaze.registerHelper('isShowDesktopDragHandles', () =>
  Utils.isShowDesktopDragHandles(),
);

Blaze.registerHelper('isTouchScreenOrShowDesktopDragHandles', () =>
  Utils.isTouchScreenOrShowDesktopDragHandles(),
);

Blaze.registerHelper('moment', (...args) => {
  args.pop(); // hash
  const [date, formatStr] = args;
  return format(new Date(date), formatStr ?? 'LLLL');
});

Blaze.registerHelper('canModifyCard', () =>
  Utils.canModifyCard(),
);

Blaze.registerHelper('canModifyBoard', () =>
  Utils.canModifyBoard(),
);
