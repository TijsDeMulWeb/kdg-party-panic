<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('minigame_id')->constrained();
            $table->unsignedTinyInteger('number');
            $table->unsignedInteger('seed');
            $table->timestamp('starts_at', 3);
            $table->timestamp('ends_at', 3);
            $table->timestamps();

            $table->index(['room_id', 'ends_at']);
        });
    }
};
