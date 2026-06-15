const express = require('express');
const router = express.Router();
const { listInboxes, createInbox, updateInbox, deleteInbox } = require('../controllers/inbox.controller');

router.get('/', listInboxes);
router.post('/', createInbox);
router.patch('/:id', updateInbox);
router.delete('/:id', deleteInbox);

module.exports = router;
