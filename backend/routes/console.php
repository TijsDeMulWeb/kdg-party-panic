<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('rooms:prune-stale')->hourly();
