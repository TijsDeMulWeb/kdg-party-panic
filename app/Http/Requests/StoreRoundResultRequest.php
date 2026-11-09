<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRoundResultRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('submitResult', $this->route('round'));
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'score' => ['required', 'integer', 'min:0'],
        ];
    }
}
