/* -*- Mode: Java; c-basic-offset: 4; tab-width: 20; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import org.mozilla.gecko.BrowserSearch.OnEditSuggestionListener;
import org.mozilla.gecko.BrowserSearch.OnSearchListener;
import org.mozilla.gecko.BrowserSearch.OnUrlOpenListener;
import org.mozilla.gecko.util.StringUtils;
import org.mozilla.gecko.widget.FaviconView;

import android.content.Context;
import android.content.res.TypedArray;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.View.OnLongClickListener;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

class SearchEngineRow extends AnimatedHeightLayout {

    // Inner views
    private final FlowLayout mSuggestionView;
    private final FaviconView mIconView;
    private final LinearLayout mUserEnteredView;
    private final TextView mUserEnteredTextView;

    // Inflater used when updating from suggestions
    private final LayoutInflater mInflater;

    // Search engine associated with this view
    private SearchEngine mSearchEngine;

    // Event listeners for suggestion views
    private final OnClickListener mClickListener;
    private final OnLongClickListener mLongClickListener;

    // On URL open listener
    private OnUrlOpenListener mUrlOpenListener;

    // On search listener
    private OnSearchListener mSearchListener;

    // On edit suggestion listener
    private OnEditSuggestionListener mEditSuggestionListener;

    public SearchEngineRow(Context context) {
        this(context, null);
    }

    public SearchEngineRow(Context context, AttributeSet attrs) {
        this(context, attrs, 0);
    }

    public SearchEngineRow(Context context, AttributeSet attrs, int defStyle) {
        super(context, attrs, defStyle);

        mClickListener = new OnClickListener() {
            @Override
            public void onClick(View v) {
                final String suggestion = getSuggestionTextFromView(v);

                // If we're not clicking the user-entered view (the first suggestion item)
                // and the search matches a URL pattern, go to that URL. Otherwise, do a
                // search for the term.
                if (v != mUserEnteredView && !StringUtils.isSearchQuery(suggestion, false)) {
                    if (mUrlOpenListener != null) {
                        mUrlOpenListener.onUrlOpen(suggestion);
                    }
                } else if (mSearchListener != null) {
                    mSearchListener.onSearch(mSearchEngine, suggestion);
                }
            }
        };

        mLongClickListener = new OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                if (mEditSuggestionListener != null) {
                    final String suggestion = getSuggestionTextFromView(v);
                    mEditSuggestionListener.onEditSuggestion(suggestion);
                    return true;
                }

                return false;
            }
        };

        mInflater = LayoutInflater.from(context);
        mInflater.inflate(R.layout.search_engine_row, this);

        mSuggestionView = (FlowLayout) findViewById(R.id.suggestion_layout);
        mIconView = (FaviconView) findViewById(R.id.suggestion_icon);

        // User-entered search term is first suggestion
        mUserEnteredView = (LinearLayout) findViewById(R.id.suggestion_user_entered);
        mUserEnteredView.setOnClickListener(mClickListener);

        mUserEnteredTextView = (TextView) findViewById(R.id.suggestion_text);
    }

    private String getSuggestionTextFromView(View v) {
        final TextView suggestionText = (TextView) v.findViewById(R.id.suggestion_text);
        return suggestionText.getText().toString();
    }

    private void setSuggestionOnView(View v, String suggestion) {
        final TextView suggestionText = (TextView) v.findViewById(R.id.suggestion_text);
        suggestionText.setText(suggestion);
    }

    public void setSearchTerm(String searchTerm) {
        mUserEnteredTextView.setText(searchTerm);
    }

    public void setOnUrlOpenListener(OnUrlOpenListener listener) {
        mUrlOpenListener = listener;
    }

    public void setOnSearchListener(OnSearchListener listener) {
        mSearchListener = listener;
    }

    public void setOnEditSuggestionListener(OnEditSuggestionListener listener) {
        mEditSuggestionListener = listener;
    }

    public void updateFromSearchEngine(SearchEngine searchEngine) {
        // Update search engine reference
        mSearchEngine = searchEngine;

        // Set the search engine icon (e.g., Google) for the row
        mIconView.updateImage(mSearchEngine.icon, mSearchEngine.name);

        // Add additional suggestions given by this engine
        final int recycledSuggestionCount = mSuggestionView.getChildCount();
        final int suggestionCount = mSearchEngine.suggestions.size();

        for (int i = 0; i < suggestionCount; i++) {
            final View suggestionItem;

            // Reuse suggestion views from recycled view, if possible
            if (i + 1 < recycledSuggestionCount) {
                suggestionItem = mSuggestionView.getChildAt(i + 1);
                suggestionItem.setVisibility(View.VISIBLE);
            } else {
                suggestionItem = mInflater.inflate(R.layout.awesomebar_suggestion_item, null);

                suggestionItem.setOnClickListener(mClickListener);
                suggestionItem.setOnLongClickListener(mLongClickListener);

                final ImageView magnifier =
                        (ImageView) suggestionItem.findViewById(R.id.suggestion_magnifier);
                magnifier.setVisibility(View.GONE);

                mSuggestionView.addView(suggestionItem);
            }

            final String suggestion = mSearchEngine.suggestions.get(i);
            setSuggestionOnView(suggestionItem, suggestion);
        }

        // Hide extra suggestions that have been recycled
        for (int i = suggestionCount + 1; i < recycledSuggestionCount; i++) {
            mSuggestionView.getChildAt(i).setVisibility(View.GONE);
        }
    }
}
