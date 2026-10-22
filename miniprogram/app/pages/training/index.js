const { createTrainingPage } = require('../../utils/training-view');
const { store } = require('../../utils/store');
Page(createTrainingPage({ store, clinical: require('../../core/clinical'), daily: require('../../core/daily'), game: require('../../core/game'), meditation: require('../../core/meditation'), platform: wx }));
