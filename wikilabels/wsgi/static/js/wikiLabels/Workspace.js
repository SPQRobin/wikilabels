( function (mw, $, OO, WL) {
	var Workspace = function ($element) {
		if ( $element === undefined || $element.length === 0 ) {
			throw '$element must be a defined element';
		}
		this.$element = $element;

		this.$menu = $('<div>').addClass( 'menu');
		this.$element.append(this.$menu);
		this.fullscreenToggle = new OO.ui.ToggleButtonWidget( {
			label: WL.i18n('fullscreen')
		} );
		this.$menu.append(this.fullscreen.$element);
		this.fullscreenToggle.on('change', this.handleFullscreenChange.bind(this));

		this.taskList = null;
		this.form = null;
		this.view = null;

		this.$controls = $('<div>').addClass( 'controls');
		this.submitButton = new OO.ui.ButtonWidget( {
			label: WL.i18n('Submit label'),
			align: 'inline',
			flags: [ 'primary', 'constructive' ]
		} );

		this.submitted = $.Callbacks();
	};
	Workspace.prototype.handleSubmitButtonClicked = function (e) {
		this.submitted.fire();
	};
	Workspace.prototype.handleTaskActivation = function (task) {
		this.view.show(task.id);
		this.taskList.select(task);
	};
	Workspace.prototype.handleFullscreenChange = function (e) {
		this.fullscreen(this.fullscreenToggle.getValue());
	};
	Workspace.prototype.loadWorkset = function (campaignId, worksetId) {
		var taskList, form, view,
		    query = WL.server.getWorkset(campaignId, worksetId);
		this.clear();
		query.done( function (doc) {
			var formQuery;
			view = new WL.views[doc['campaign']['view']](doc['tasks']);
			try {
				view = new WL.views[doc['campaign']['view']](doc['tasks']);
			} catch (err) {
				alert('Could not load view "' + doc['campaign']['view'] + '": ' + err +
				      '\nUsing simple task viewer.');
				view = new WL.views.View(doc['tasks']);
			}

			taskList = new TaskList(doc['tasks']);

			formQuery = WL.server.getForm(doc['campaign']['form']);
			formQuery.done( function (formDoc) {
				try {
					form = WL.Form.fromConfig(formDoc['form'], mw.config.get('wgUserLanguage'));
					this.load(taskList, form, view);
				} catch (err) {
					alert(
						'Could not load form "' + doc['campaign']['form'] + '": \n' + err
					);
				}
			}.bind(this));
			formQuery.fail( function (errorDoc) {
				alert(
					'Could not load form "' + doc['campaign']['form'] + '": \n' +
					JSON.stringify(errorDoc, null, 2)
				);
			}.bind(this) );
		}.bind(this) );
	};
	Workspace.prototype.load = function (taskList, form, view) {

		this.$element.empty(); // Clears out old elements

		this.taskList = taskList;
		this.$element.append(taskList.$element);
		this.taskList.taskActivated.add(this.handleTaskActivation.bind(this));

		this.form = form;
		this.$element.append(form.$element);

		this.view = view;
		this.$element.append(view.$element);
	};
	Workspace.prototype.fullscreen = function (fullscreen) {
		if ( fullscreen === undefined) {
			return this.$element.hasClass( 'fullscreen');
		} else if ( fullscreen ) {
			this.$element.addClass( 'fullscreen');
			return this;
		} else {
			this.$element.removeClass( 'fullscreen');
			return this;
		}
	};
	Workspace.prototype.clear = function () {
		this.$element.empty();
	};

	var TaskList = function (taskListData) {
		this.$element = $('<div>').addClass('task-list');

		this.$header = $('<div>').addClass('header').text(WL.i18n("Workset"));
		this.$element.append(this.$header);

		this.tasks = null;
		this.$tasks = $('<div>').addClass('tasks');
		this.$element.append(this.$tasks);
		this.$tasksTable = $('<table>').addClass('table');
		this.$tasks.append(this.$tasksTable);
		this.$tasksRow = $('<tr>').addClass('row');
		this.$tasksTable.append(this.$tasksRow);

		this.selectedTaskInfo = null;
		this.taskActivated = $.Callbacks();

		this.load(taskListData);
	};
	TaskList.prototype.handleTaskActivation = function (task) {
		this.taskActivated.fire(task);
	};
	TaskList.prototype.load = function (taskListData) {
		var taskData, task, i;

		this.$tasksRow.empty(); // Just in case there was something in there.
		this.tasks = [];
		for (i = 0; i < taskListData.length; i++) {
			taskData = taskListData[i];

			task = new Task(i, taskData);
			task.activated.add(this.handleTaskActivation.bind(this));
			this.tasks.push(task);
			this.$tasksRow.append(task.$element);
		}

		this.selectByIndex(0);
	};
	TaskList.prototype.select = function (task) {
		if (this.selectedTask) {
			this.selectedTask.select(false);
		}
		if (task) {
			task.select(true);
		}
		this.selectedTask = task;
	};
	TaskList.prototype.selectByIndex = function (index) {
		if (index >= this.tasks.length) {
			throw "Could not select task. Index " + index + " out of bounds.";
		}
		this.select(this.tasks[index]);
	};
	TaskList.prototype.shift = function (delta) {
		var newI;
		if (!this.selectedTask) {
			throw "No task assigned.  Can't shift().";
		}
		newI = (this.selectedTask.i + delta) % this.tasks.length;
		this.select(this.tasks[newI]);
	};
	TaskList.prototype.next = function () {
		return this.shift(1);
	};
	TaskList.prototype.prev = function () {
		return this.shift(-1);
	};
	TaskList.prototype.allComplete = function () {
		var i, task;
		for (i = 0; i < this.tasks.length; i++) {
			task = this.tasks[i];
			if (!task.complete()) {
				return false;
			}
		}
		return true;
	};

	var Task = function (i, taskData) {
		this.$element = $('<td>').addClass( 'task');
		this.$element.click(this.handleClick.bind(this));

		this.i = i;
		this.selected = $.Callbacks();
		this.activated = $.Callbacks();

		this.load(taskData);
	};
	Task.prototype.handleClick = function (e) {
		if ( !this.disable() ) {
			this.activated.fire(this);
		}
	};
	Task.prototype.load = function (taskData) {
		this.$element.empty();
		this.id = taskData.id;
		this.taskData = taskData['task_data'];
		this.label = new Label(taskData['labels']);
		this.$element.append(this.label.$element);
	};
	Task.prototype.select = function (selected) {
		if ( selected === undefined) {
			return this.$element.hasClass('selected');
		} else if ( selected ) {
			this.$element.addClass('selected');
			this.selected.fire();
			return this;
		} else {
			this.$element.removeClass('selected');
			return this;
		}
	};
	Task.prototype.setWidth = function (width) {
		this.$element.css('width', width);
	};
	Task.prototype.disable = function (disabled) {
		if ( disabled === undefined) {
			return this.$element.hasClass('disabled');
		} else if ( disabled ) {
			this.$element.addClass('disabled');
			return this;
		} else {
			this.$element.removeClass('disabled');
			return this;
		}
	};
	Task.prototype.complete = function () {
		return this.label.complete();
	};

	var Label = function (labelData) {
		this.$element = $("<div>").addClass("label");
		this.load(labelData);
		this.data = null;
	};
	Label.prototype.load = function (labelData) {
		this.$element.empty();

		if ( labelData ) {
			this.data = labelData;
		} else {
			this.data = null;
		}
	};

	wikiLabels.Workspace = Workspace;
})(mediaWiki, jQuery, OO, wikiLabels);
