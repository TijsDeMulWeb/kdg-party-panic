<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_challenges', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->foreignId('minigame_id')->constrained();
            $table->unsignedInteger('seed');
            $table->timestamps();
        });

        Schema::create('runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('minigame_id')->constrained();
            $table->foreignId('daily_challenge_id')->nullable()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('seed');
            $table->boolean('is_official')->default(false);
            $table->unsignedInteger('score')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->index(['minigame_id', 'score']);
            $table->index(['daily_challenge_id', 'is_official', 'score']);
        });
    }
};
