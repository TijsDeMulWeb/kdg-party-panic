<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('party_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('match_rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_match_id')->constrained()->cascadeOnDelete();
            $table->foreignId('minigame_id')->constrained();
            $table->unsignedTinyInteger('number');
            $table->unsignedInteger('seed');
            $table->timestamp('starts_at', 3)->nullable();
            $table->timestamp('ends_at', 3)->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->unique(['party_match_id', 'number']);
        });

        Schema::create('match_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_match_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('character_id')->constrained();
            $table->unsignedTinyInteger('final_rank')->nullable();
            $table->unsignedSmallInteger('total_points')->default(0);
            $table->timestamps();

            $table->unique(['party_match_id', 'user_id']);
        });

        Schema::create('round_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_round_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('score')->default(0);
            $table->unsignedTinyInteger('placement')->nullable();
            $table->unsignedTinyInteger('points')->default(0);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['match_round_id', 'user_id']);
        });
    }
};
